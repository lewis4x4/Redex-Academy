/**
 * Engine #5 — declarative 2D-interaction, headless core (F5b). One state machine
 * over a list of items the learner answers: drag-label (place labels on regions),
 * match (left↔right), sort (order elements), hotspot (tap the correct region(s)).
 * Each item is graded against its `answer_key` into a RubricResult fed to the
 * SHARED Verdict service (no per-engine scoring) — a safety-flagged item that's
 * answered wrong routes through the non-overridable veto (AC-102 fail-safe/
 * fail-locked items are safety_compliance). xAPI emitted + queued offline.
 */
import type { Interaction2dSpec } from '@redex/sim-schemas';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { LoadSpecOptions, RubricResult, SimInstanceBase, Verdict } from '../../api';
import { createI18nResolver } from '../../i18n/resolver';
import { SIM_STRINGS } from '../../i18n/sim-strings';
import { createEmitter, resultFromVerdict } from '../../telemetry/emitter';
import { computeVerdict } from '../../verdict/verdict';

type Spec = Interaction2dSpec;
type Item = Spec['items'][number];

/** A mapping (drag-label/match) or an ordered/selected list (sort/hotspot). */
export type ItemAnswer = Record<string, string> | string[];

export interface Interaction2dState {
  answers: Record<string, ItemAnswer>;
  complete: boolean;
}

export interface Interaction2dInstance extends SimInstanceBase<Interaction2dState> {
  engineKind: 'interaction_2d';
  spec: Spec;
  /** Place a label onto a region (drag-label) / map a left item to a right (match). */
  place(itemId: string, key: string, value: string): void;
  /** Set the ordered element ids (sort). */
  setOrder(itemId: string, order: string[]): void;
  /** Toggle a tapped region (hotspot). */
  tap(itemId: string, regionId: string): void;
  /** The learner's current answer for an item (for the renderer). */
  answerFor(itemId: string): ItemAnswer | undefined;
  /** Finalize: grade every item via Verdict, emit completion + any safety veto. */
  submit(): Verdict;
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean => {
  if (a.length !== b.length) return false;
  const as = new Set(a);
  return b.every((x) => as.has(x)) && as.size === b.length;
};
const sameOrder = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/** Grade ONE item: did the learner's answer match its answer_key (all-or-nothing)? */
function itemPassed(item: Item, answer: ItemAnswer | undefined): boolean {
  switch (item.kind) {
    case 'drag-label':
    case 'label':
    case 'match': {
      const key = item.answer_key as Record<string, string>;
      const ans = (answer as Record<string, string>) ?? {};
      const entries = Object.entries(key);
      return entries.length > 0 && entries.every(([k, v]) => ans[k] === v);
    }
    case 'sort':
      return sameOrder((answer as string[]) ?? [], item.answer_key as string[]);
    case 'hotspot':
      return sameSet((answer as string[]) ?? [], item.answer_key as string[]);
    default:
      return false;
  }
}

export function createInteraction2dSim(
  spec: Spec,
  opts: LoadSpecOptions = {},
): Interaction2dInstance {
  const env = spec.envelope;
  const locale = opts.locale === 'es' ? 'es' : 'en';
  const i18n = createI18nResolver(SIM_STRINGS, locale);
  const genUuid = opts.genUuid ?? (() => globalThis.crypto.randomUUID());
  const now = opts.now ?? (() => new Date().toISOString());
  const actor = opts.actor ?? { homePage: 'https://academy.goredex.com', name: 'anonymous' };

  const emitter = createEmitter({
    simId: env.sim_id,
    engineKind: 'interaction_2d',
    actor,
    context: { ...opts.context, offline: opts.context?.offline ?? false },
    sink: opts.telemetrySink,
    genUuid,
    now,
  });

  const initial = (): Interaction2dState => ({ answers: {}, complete: false });
  const store: StoreApi<Interaction2dState> = createStore<Interaction2dState>(() => initial());

  const itemById = (id: string): Item => {
    const it = spec.items.find((x) => x.id === id);
    if (!it) throw new Error(`interaction-2d: unknown item '${id}'`);
    return it;
  };
  const guardOpen = (): Interaction2dState => {
    const st = store.getState();
    if (st.complete) throw new Error('interaction-2d: attempt already complete');
    return st;
  };

  const evaluate = (): RubricResult[] =>
    spec.items.map((item) => {
      const passed = itemPassed(item, store.getState().answers[item.id]);
      const max = item.scoring.weight;
      return {
        ref: item.id,
        dimension: item.scoring.dimension,
        ...(item.scoring.line_item_key ? { line_item_key: item.scoring.line_item_key } : {}),
        safety_flag: item.scoring.safety_flag,
        awarded: passed ? max : 0,
        max,
        passed,
        feedback_i18n: item.feedback_i18n,
      };
    });

  const getVerdict = (): Verdict => computeVerdict(env.scoring, evaluate(), env.state_tokens);

  const instance: Interaction2dInstance = {
    engineKind: 'interaction_2d',
    simId: env.sim_id,
    envelope: env,
    spec,
    store,
    place(itemId, key, value) {
      const it = itemById(itemId);
      if (it.kind === 'sort' || it.kind === 'hotspot') {
        throw new Error(`interaction-2d: place() not valid for '${it.kind}' item '${itemId}'`);
      }
      const st = guardOpen();
      const prev = (st.answers[itemId] as Record<string, string>) ?? {};
      store.setState({ answers: { ...st.answers, [itemId]: { ...prev, [key]: value } } });
      emitter.emit({ verb: emitter.verbs.answered, objectId: itemId });
    },
    setOrder(itemId, order) {
      const it = itemById(itemId);
      if (it.kind !== 'sort')
        throw new Error(`interaction-2d: setOrder() only for 'sort' ('${itemId}')`);
      const st = guardOpen();
      store.setState({ answers: { ...st.answers, [itemId]: [...order] } });
      emitter.emit({ verb: emitter.verbs.answered, objectId: itemId });
    },
    tap(itemId, regionId) {
      const it = itemById(itemId);
      if (it.kind !== 'hotspot')
        throw new Error(`interaction-2d: tap() only for 'hotspot' ('${itemId}')`);
      const st = guardOpen();
      const prev = (st.answers[itemId] as string[]) ?? [];
      const next = prev.includes(regionId)
        ? prev.filter((r) => r !== regionId)
        : [...prev, regionId];
      store.setState({ answers: { ...st.answers, [itemId]: next } });
      emitter.emit({ verb: emitter.verbs.answered, objectId: itemId });
    },
    answerFor: (itemId) => store.getState().answers[itemId],
    submit() {
      const verdict = getVerdict();
      store.setState({ complete: true });
      if (verdict.safety_veto_triggered) emitter.emit({ verb: emitter.verbs.triggeredSafetyVeto });
      emitter.emit({ verb: emitter.verbs.completed, result: resultFromVerdict(verdict) });
      return verdict;
    },
    getVerdict,
    isComplete: () => store.getState().complete,
    t: (key) => i18n.t(key),
    onTelemetry: (cb) => emitter.subscribe(cb),
    reset() {
      store.setState(initial(), true);
      emitter.emit({ verb: emitter.verbs.attempted });
    },
  };

  emitter.emit({ verb: emitter.verbs.attempted });
  return instance;
}
