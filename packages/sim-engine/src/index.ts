// @redex/sim-engine — the Forge: the shared sim runtime + engines #1 (branching)
// and #2 (device-config). Authors write declarative specs validated against
// @redex/sim-schemas; they never write a runtime. This barrel is the documented
// consumer contract M3/M4/M5/M9/M10 build against (signed off at the F5 human gate).

// ── Public entry + preview/sandbox ──────────────────────────────────────────
export { loadSpec, type AnySimInstance } from './loadSpec';
export { previewSpec, isValidSpec, type PreviewResult } from './preview/harness';

// ── Engine API contract (types) ─────────────────────────────────────────────
export type {
  EngineKindValue,
  LoadSpecOptions,
  RubricResult,
  SimInstanceBase,
  TelemetrySink,
  Verdict,
  VerdictKind,
} from './api';

// ── Shared services (built once, used by every engine) ──────────────────────
export { computeVerdict, type ScoringHook } from './verdict/verdict';
export {
  createEmitter,
  resultFromVerdict,
  XAPI_VERBS,
  type Emitter,
  type EmitterDeps,
} from './telemetry/emitter';
export {
  DEFAULT_STATE_TOKENS,
  resolveStateToken,
  SHAPE_GLYPH,
  type StateToken,
} from './colorblind/tokens';
export { StateBadge, type StateBadgeProps } from './colorblind/StateBadge';
export {
  createI18nResolver,
  type I18nResolver,
  type SimLocale,
  type SimStringTable,
} from './i18n/resolver';
export { SIM_STRINGS } from './i18n/sim-strings';
export { SimFrame, type RenderMode, type SimFrameProps } from './fallback-2d/Schematic';

// ── Engine #1 — branching scenario ──────────────────────────────────────────
export {
  createBranchingSim,
  type BranchingInstance,
  type BranchingState,
  type BranchingChoice,
} from './engines/branching/core';
export { BranchingSim, type BranchingSimProps } from './engines/branching/BranchingSim';

// ── Engine #2 — device-config state machine ─────────────────────────────────
export {
  createDeviceConfigSim,
  type DeviceConfigInstance,
  type DeviceConfigState,
} from './engines/device-config/core';
export {
  DeviceConfigSim,
  type DeviceConfigSimProps,
} from './engines/device-config/DeviceConfigSim';
export { evalExpr, type ExprContext } from './engines/device-config/expr';

// ── Engine #5 — declarative 2D-interaction (F5b) ────────────────────────────
export {
  createInteraction2dSim,
  type Interaction2dInstance,
  type Interaction2dState,
  type ItemAnswer,
} from './engines/interaction-2d/core';
export {
  Interaction2dSim,
  type Interaction2dSimProps,
} from './engines/interaction-2d/Interaction2dSim';

// ── Engine #6 — parametric calculator (F5b) ─────────────────────────────────
export {
  createCalculatorSim,
  type CalculatorInstance,
  type CalculatorState,
  type InputValue,
} from './engines/calculator/core';
export { CalculatorSim, type CalculatorSimProps } from './engines/calculator/CalculatorSim';
export {
  runCompute,
  compareThreshold,
  COMPUTE_INPUTS,
  type Inputs,
  type ThresholdOp,
} from './engines/calculator/compute';

// ── Engine #4 — panel state machine (Phase-2 stub; API surface reserved) ─────
export { createPanelStateSim, PANEL_STATE_ENGINE_KIND } from './engines/panel-state.stub';
