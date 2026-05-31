/**
 * Engine #6 — parametric calculator, headless core (F5b). The learner sets typed
 * inputs; a registered deterministic `compute_ref` (compute.ts) produces the
 * result; `thresholds` (pass/warn/fail bands) become RubricResults fed to the
 * SHARED Verdict service (no per-engine scoring) — a safety_flag fail band that
 * the result lands in routes through the non-overridable veto. The compute path
 * is pure + unit-checked + LLM-free (determinism invariant). The renderer drives a
 * colorblind-safe budget meter (shape + numeric value + color, never color alone).
 */
import type { CalculatorSpec } from '@redex/sim-schemas';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { LoadSpecOptions, RubricResult, SimInstanceBase, Verdict } from '../../api';
import { createI18nResolver } from '../../i18n/resolver';
import { SIM_STRINGS } from '../../i18n/sim-strings';
import { createEmitter, resultFromVerdict } from '../../telemetry/emitter';
import { computeVerdict } from '../../verdict/verdict';
import { compareThreshold, runCompute, type Inputs } from './compute';

type Spec = CalculatorSpec;
export type InputValue = number | string | boolean;

export interface CalculatorState {
  inputs: Record<string, InputValue>;
  complete: boolean;
}

export interface CalculatorInstance extends SimInstanceBase<CalculatorState> {
  engineKind: 'calculator';
  spec: Spec;
  /** Set a typed input value (must be a declared input id). */
  setInput(id: string, value: InputValue): void;
  /** Run the deterministic computation over the current inputs (pure). */
  compute(): number;
  /** The threshold ids whose band the current result lands in (for the meter/feedback). */
  matchedBands(): { id: string; band: 'pass' | 'warn' | 'fail' }[];
  /** Finalize: evaluate thresholds via Verdict, emit completion + any safety veto. */
  submit(): Verdict;
}

export function createCalculatorSim(spec: Spec, opts: LoadSpecOptions = {}): CalculatorInstance {
  const env = spec.envelope;
  const locale = opts.locale === 'es' ? 'es' : 'en';
  const i18n = createI18nResolver(SIM_STRINGS, locale);
  const genUuid = opts.genUuid ?? (() => globalThis.crypto.randomUUID());
  const now = opts.now ?? (() => new Date().toISOString());
  const actor = opts.actor ?? { homePage: 'https://academy.goredex.com', name: 'anonymous' };

  const emitter = createEmitter({
    simId: env.sim_id,
    engineKind: 'calculator',
    actor,
    context: { ...opts.context, offline: opts.context?.offline ?? false },
    sink: opts.telemetrySink,
    genUuid,
    now,
  });

  const seedInputs = (): Record<string, InputValue> => {
    const out: Record<string, InputValue> = {};
    for (const [id, input] of Object.entries(spec.inputs)) {
      if (input.default !== undefined) out[id] = input.default as InputValue;
    }
    return out;
  };
  const initial = (): CalculatorState => ({ inputs: seedInputs(), complete: false });
  const store: StoreApi<CalculatorState> = createStore<CalculatorState>(() => initial());

  const compute = (): number => runCompute(spec.compute_ref, store.getState().inputs as Inputs);

  // Each scored threshold → one RubricResult. A 'pass' band asserts a good
  // condition (passed = matched); a 'fail'/'warn' band asserts a bad one (passed =
  // NOT matched), so a safety band the result lands in is a failed safety result →
  // the Verdict service vetoes. 'warn' bands are normally advisory (renderer only)
  // and excluded from scoring — but a safety_flag threshold is NEVER dropped,
  // whatever its band, so a safety condition always reaches the non-overridable
  // veto (fail-closed; the schema also forbids a safety_flag 'warn' band).
  const evaluate = (result: number): RubricResult[] =>
    spec.thresholds
      .filter((t) => t.band !== 'warn' || t.safety_flag)
      .map((t) => {
        const matched = compareThreshold(result, t.op, t.value, t.value_high);
        const passed = t.band === 'pass' ? matched : !matched;
        return {
          ref: t.id,
          dimension: t.dimension,
          ...(t.line_item_key ? { line_item_key: t.line_item_key } : {}),
          safety_flag: t.safety_flag,
          awarded: passed ? 1 : 0,
          max: 1,
          passed,
          ...(t.feedback_i18n ? { feedback_i18n: t.feedback_i18n } : {}),
        };
      });

  const getVerdict = (): Verdict =>
    computeVerdict(env.scoring, evaluate(compute()), env.state_tokens);

  const instance: CalculatorInstance = {
    engineKind: 'calculator',
    simId: env.sim_id,
    envelope: env,
    spec,
    store,
    setInput(id, value) {
      if (!(id in spec.inputs)) throw new Error(`calculator: unknown input '${id}'`);
      const st = store.getState();
      if (st.complete) throw new Error('calculator: attempt already complete');
      store.setState({ inputs: { ...st.inputs, [id]: value } });
      emitter.emit({ verb: emitter.verbs.answered, objectId: id });
    },
    compute,
    matchedBands() {
      const result = compute();
      return spec.thresholds
        .filter((t) => compareThreshold(result, t.op, t.value, t.value_high))
        .map((t) => ({ id: t.id, band: t.band }));
    },
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
