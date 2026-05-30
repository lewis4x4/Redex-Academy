/**
 * Engine #2 — device-config state machine, headless core (F5 §9-10). A rules-driven
 * state machine over a simulated device UI that REPLAYS a sanitized recorded fixture
 * (a faithful interactive replica — NEVER a live API, invariant 6). The learner edits
 * fields across screens; each assertion_rule is a whitelisted predicate (expr.ts, no
 * eval) evaluated to a RubricResult fed to the SHARED Verdict service. Same Verdict +
 * telemetry as every other engine.
 */
import {
  FixtureSetManifest,
  assertFixtureLoadable,
  type DeviceConfigSpec,
} from '@redex/sim-schemas';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { LoadSpecOptions, RubricResult, SimInstanceBase, Verdict } from '../../api';
import { createI18nResolver } from '../../i18n/resolver';
import { SIM_STRINGS } from '../../i18n/sim-strings';
import { createEmitter, resultFromVerdict } from '../../telemetry/emitter';
import { computeVerdict } from '../../verdict/verdict';
import { evalExpr } from './expr';

type Spec = DeviceConfigSpec;

export interface DeviceConfigState {
  fields: Record<string, unknown>;
  editOrder: string[];
  currentScreenId: string;
  complete: boolean;
}

export interface DeviceConfigInstance extends SimInstanceBase<DeviceConfigState> {
  engineKind: 'device_config';
  /** The validated spec (screens/fields/rules) — read-only, for the renderer. */
  spec: Spec;
  /** Edit a field value (records edit order for set_before/reassigned_before). */
  setField(fieldId: string, value: unknown): void;
  /** Move to another screen (must exist in the spec). */
  navigate(screenId: string): void;
  /** Finalize the attempt: evaluate rules, emit completion + any safety veto. */
  submit(): Verdict;
  /** The fixture-image R2 key for a screen (for the replica renderer), if any. */
  screenImageKey(screenId: string): string | undefined;
}

export function createDeviceConfigSim(
  spec: Spec,
  opts: LoadSpecOptions = {},
): DeviceConfigInstance {
  const env = spec.envelope;
  const locale = opts.locale === 'es' ? 'es' : 'en';
  const i18n = createI18nResolver(SIM_STRINGS, locale);
  const genUuid = opts.genUuid ?? (() => globalThis.crypto.randomUUID());
  const now = opts.now ?? (() => new Date().toISOString());
  const actor = opts.actor ?? { homePage: 'https://academy.goredex.com', name: 'anonymous' };

  // Replay engines load a SANITIZED fixture only (publish gate, invariant 6).
  const fixture = opts.fixture ? FixtureSetManifest.parse(opts.fixture) : undefined;
  if (fixture) assertFixtureLoadable(fixture);

  const recorded: Record<string, unknown> = {};
  if (fixture) {
    for (const s of fixture.screens) {
      for (const f of s.field_map)
        if (f.recorded_value !== undefined) recorded[f.field_id] = f.recorded_value;
    }
  }
  // Seed defaults: fixture recorded values first, then any spec field defaults.
  const seedFields = (): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [id, f] of Object.entries(spec.fields)) {
      if (id in recorded) out[id] = recorded[id];
      else if (f.default !== undefined) out[id] = f.default;
    }
    return out;
  };

  const emitter = createEmitter({
    simId: env.sim_id,
    engineKind: 'device_config',
    actor,
    context: { ...opts.context, offline: opts.context?.offline ?? false },
    sink: opts.telemetrySink,
    genUuid,
    now,
  });

  const firstScreen = [...spec.screens].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))[0];
  const initial = (): DeviceConfigState => ({
    fields: seedFields(),
    editOrder: [],
    currentScreenId: firstScreen?.id ?? spec.screens[0]?.id ?? '',
    complete: false,
  });
  const store: StoreApi<DeviceConfigState> = createStore<DeviceConfigState>(() => initial());

  const evaluate = (): RubricResult[] => {
    const st = store.getState();
    const ctx = { fields: new Map(Object.entries(st.fields)), editOrder: st.editOrder };
    return spec.assertion_rules.map((r) => {
      let passed = false;
      try {
        passed = evalExpr(r.expr, ctx);
      } catch {
        passed = false; // a malformed predicate fails closed (never a silent pass)
      }
      const max = r.weight;
      return {
        ref: r.id,
        dimension: r.dimension,
        line_item_key: r.line_item_key,
        safety_flag: r.safety_flag,
        awarded: passed ? max : 0,
        max,
        passed,
        feedback_i18n: r.fail_feedback_i18n,
      };
    });
  };

  const getVerdict = (): Verdict => computeVerdict(env.scoring, evaluate(), env.state_tokens);

  const instance: DeviceConfigInstance = {
    engineKind: 'device_config',
    simId: env.sim_id,
    envelope: env,
    spec,
    store,
    setField(fieldId, value) {
      if (!(fieldId in spec.fields)) throw new Error(`device-config: unknown field '${fieldId}'`);
      const st = store.getState();
      if (st.complete) throw new Error('device-config: attempt already complete');
      store.setState({
        fields: { ...st.fields, [fieldId]: value },
        editOrder: [...st.editOrder, fieldId],
      });
      emitter.emit({ verb: emitter.verbs.answered, objectId: fieldId });
    },
    navigate(screenId) {
      if (!spec.screens.some((s) => s.id === screenId))
        throw new Error(`device-config: unknown screen '${screenId}'`);
      store.setState({ currentScreenId: screenId });
    },
    submit() {
      const verdict = getVerdict();
      store.setState({ complete: true });
      if (verdict.safety_veto_triggered) emitter.emit({ verb: emitter.verbs.triggeredSafetyVeto });
      emitter.emit({ verb: emitter.verbs.completed, result: resultFromVerdict(verdict) });
      return verdict;
    },
    screenImageKey(screenId) {
      const fromSpec = spec.screens.find((s) => s.id === screenId)?.fixture_image_r2_key;
      const fromFixture = fixture?.screens.find((s) => s.id === screenId)?.image_r2_key;
      return fromSpec ?? fromFixture;
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
