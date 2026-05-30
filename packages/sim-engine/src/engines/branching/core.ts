/**
 * Engine #1 — branching scenario, headless core (F5 §7-8). A state machine over
 * the scenario graph: the learner walks situation/prompt nodes via choice edges to
 * a terminal (pass / safety-veto fail). Each graded choice becomes a RubricResult
 * fed to the SHARED Verdict service (no per-engine scoring). Every choice + the
 * terminal emit xAPI through the shared emitter. React renderers (rich + 2D) drive
 * this same instance, so they score identically.
 */
import type { BranchingSpec } from '@redex/sim-schemas';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { LoadSpecOptions, RubricResult, SimInstanceBase, Verdict } from '../../api';
import { createI18nResolver } from '../../i18n/resolver';
import { SIM_STRINGS } from '../../i18n/sim-strings';
import { createEmitter, resultFromVerdict } from '../../telemetry/emitter';
import { computeVerdict } from '../../verdict/verdict';

type Spec = BranchingSpec;
type Node = Spec['nodes'][string];

export interface BranchingState {
  currentNodeId: string;
  path: { nodeId: string; edgeId: string }[];
  results: RubricResult[];
  complete: boolean;
  terminalId: string | null;
}

export interface BranchingChoice {
  id: string;
  label: string;
  is_safety_decision: boolean;
}

export interface BranchingInstance extends SimInstanceBase<BranchingState> {
  engineKind: 'branching_scenario';
  /** The current node (situation/prompt/terminal). */
  currentNode(): Node;
  /** The choices available at the current node (empty at a terminal). */
  choices(): BranchingChoice[];
  /** Make a choice by edge id. Advances the graph; throws if invalid/complete. */
  choose(edgeId: string): void;
}

export function createBranchingSim(spec: Spec, opts: LoadSpecOptions = {}): BranchingInstance {
  const env = spec.envelope;
  const locale = opts.locale === 'es' ? 'es' : 'en';
  const i18n = createI18nResolver(SIM_STRINGS, locale);
  const genUuid = opts.genUuid ?? (() => globalThis.crypto.randomUUID());
  const now = opts.now ?? (() => new Date().toISOString());
  const actor = opts.actor ?? { homePage: 'https://academy.goredex.com', name: 'anonymous' };

  const emitter = createEmitter({
    simId: env.sim_id,
    engineKind: 'branching_scenario',
    actor,
    context: { ...opts.context, offline: opts.context?.offline ?? false },
    sink: opts.telemetrySink,
    genUuid,
    now,
  });

  const initial = (): BranchingState => ({
    currentNodeId: spec.start,
    path: [],
    results: [],
    complete: false,
    terminalId: null,
  });
  const store: StoreApi<BranchingState> = createStore<BranchingState>(() => initial());

  const node = (id: string): Node => {
    const n = spec.nodes[id];
    if (!n) throw new Error(`branching: node '${id}' not found`);
    return n;
  };

  const getVerdict = (): Verdict => {
    const state = store.getState();
    // Defense-in-depth: if the reached terminal was authored safety_veto:true,
    // force the veto even if (somehow) no safety result was recorded.
    const term = state.terminalId ? spec.nodes[state.terminalId] : undefined;
    const forceSafetyVeto = term?.type === 'terminal' && term.safety_veto === true;
    return computeVerdict(env.scoring, state.results, env.state_tokens, { forceSafetyVeto });
  };

  const instance: BranchingInstance = {
    engineKind: 'branching_scenario',
    simId: env.sim_id,
    envelope: env,
    store,
    currentNode: () => node(store.getState().currentNodeId),
    choices() {
      const n = this.currentNode();
      if (n.type === 'terminal') return [];
      return n.choices.map((c) => ({
        id: c.id,
        label: i18n.t(c.label_i18n),
        is_safety_decision: c.is_safety_decision,
      }));
    },
    choose(edgeId: string) {
      const state = store.getState();
      if (state.complete) throw new Error('branching: attempt already complete');
      const cur = node(state.currentNodeId);
      if (cur.type === 'terminal') throw new Error('branching: cannot choose at a terminal');
      const edge = cur.choices.find((c) => c.id === edgeId);
      if (!edge) throw new Error(`branching: no choice '${edgeId}' at '${state.currentNodeId}'`);

      const results = state.results.slice();
      // A safety_flag edge is ALWAYS graded as a safety_compliance result — even if
      // it carries no authored `verdict` mapping — so a wrong safety choice can
      // never silently bypass the veto (the schema also now requires this). Other
      // edges are graded only when they declare a verdict mapping.
      if (edge.verdict || edge.safety_flag) {
        // A safety_flag edge IS the wrong safety choice by definition → it ALWAYS
        // fails (never inferred from score_delta, so an author's non-negative delta
        // can't sneak a flagged wrong choice past the veto). Others pass on delta≥0.
        const passed = edge.safety_flag ? false : edge.score_delta >= 0;
        const max = Math.abs(edge.score_delta) || 1;
        const dimension = edge.safety_flag
          ? 'safety_compliance'
          : (edge.verdict?.dimension ?? 'technical_execution');
        results.push({
          ref: edge.id,
          dimension,
          line_item_key: edge.verdict?.line_item_key,
          safety_flag: edge.safety_flag,
          awarded: passed ? max : 0,
          max,
          passed,
          feedback_i18n: edge.consequence_i18n,
        });
      }

      const target = node(edge.to);
      const complete = target.type === 'terminal';
      store.setState({
        currentNodeId: edge.to,
        path: [...state.path, { nodeId: state.currentNodeId, edgeId }],
        results,
        complete,
        terminalId: complete ? edge.to : null,
      });

      emitter.emit({
        verb: emitter.verbs.answered,
        objectId: state.currentNodeId,
        objectName: { en: edgeId },
      });

      if (complete) {
        const verdict = getVerdict();
        if (verdict.safety_veto_triggered) {
          emitter.emit({ verb: emitter.verbs.triggeredSafetyVeto, objectId: edge.to });
        }
        emitter.emit({
          verb: emitter.verbs.completed,
          objectId: edge.to,
          result: resultFromVerdict(verdict),
        });
      }
    },
    getVerdict,
    isComplete: () => store.getState().complete,
    t: (key: string) => i18n.t(key),
    onTelemetry: (cb) => emitter.subscribe(cb),
    reset() {
      store.setState(initial(), true);
      emitter.emit({ verb: emitter.verbs.attempted, objectId: spec.start });
    },
  };

  emitter.emit({ verb: emitter.verbs.attempted, objectId: spec.start });
  return instance;
}
