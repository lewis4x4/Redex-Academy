/**
 * The Forge engine public API (F5 §1 / DRY_RUN §4) — the STABLE consumer contract
 * that M3/M4/M5/M9/M10 build against (the #2 risk bet; signed off before consumers).
 *
 * Every engine implements `loadSpec(spec, opts?) → SimInstance`. A SimInstance is
 * a headless, framework-agnostic state machine (a vanilla Zustand store) exposing:
 * the interaction primitives, `getVerdict()` (the SHARED Verdict service — never a
 * per-engine reimplementation), a telemetry subscription (xAPI, queued offline via
 * F4), and an i18n string resolver. React renderers (rich + 2D fallback) drive the
 * SAME instance, so the 2D fallback is a first-class path with an IDENTICAL Verdict.
 */
import type {
  ColorblindSafeState,
  EngineKind,
  RubricDimension,
  SimEnvelope,
  XapiTelemetryEvent,
} from '@redex/sim-schemas';
import type { StoreApi } from 'zustand/vanilla';

export type EngineKindValue = EngineKind;
export type VerdictKind = 'pass' | 'fail' | 'safety_veto';

/**
 * One graded outcome the Verdict service consumes (a chosen branch, a device
 * assertion). The shared service — not the engine — decides pass/fail/veto from
 * these, so every engine scores identically.
 */
export interface RubricResult {
  /** Stable id of the thing graded (edge id / assertion id). */
  ref: string;
  dimension: RubricDimension;
  line_item_key?: string;
  /** A safety-flagged result: a single failure here vetoes the attempt. */
  safety_flag: boolean;
  awarded: number;
  max: number;
  passed: boolean;
  /** Instant/specific/diagnostic feedback i18n key for a failure (names the fix). */
  feedback_i18n?: string;
}

/** The Verdict — mirrors the DB safety rule; authoritative mastery is server-side. */
export interface Verdict {
  kind: VerdictKind;
  /** Maps to sim_attempts.outcome. */
  outcome: 'pass' | 'fail';
  /** Maps to sim_attempts.safety_veto_triggered. */
  safety_veto_triggered: boolean;
  /** Non-safety scoring summary. scaled ∈ [0,1]. */
  score: { scaled: number; raw: number; max: number };
  /** Safety-subset scaled score ∈ [0,1] (1 when there are no safety items). */
  safety_score: number;
  /** The failing results (drives feedback). */
  failed: RubricResult[];
  /** When vetoed, the spec's veto feedback key (the consequence + the fix). */
  veto_feedback_i18n?: string;
  /** The colorblind-safe state token to render (shape + text + color). */
  state: ColorblindSafeState;
}

/** A telemetry sink — the app wires F4's offline xAPI queue here (default: in-memory). */
export type TelemetrySink = (event: XapiTelemetryEvent) => void | Promise<void>;

export interface LoadSpecOptions {
  /** Active locale for the i18n resolver (EN default; ES is MVP second). */
  locale?: string;
  /** The sanitized fixture manifest for replay engines (device_config). */
  fixture?: unknown;
  /** Where telemetry goes (F4 queue in the app; collected in-memory by default). */
  telemetrySink?: TelemetrySink;
  /** xAPI actor identity (auth.users.id + homepage). Anonymous toy default otherwise. */
  actor?: { homePage: string; name: string };
  /** Reconciliation identifiers carried in xAPI context.extensions. */
  context?: {
    org_id?: string;
    sim_definition_id?: string;
    registration?: string;
    offline?: boolean;
  };
  /** Injectable for deterministic tests (default: crypto.randomUUID / Date). */
  genUuid?: () => string;
  now?: () => string;
}

/** The common headless instance surface every engine returns. */
export interface SimInstanceBase<TState> {
  engineKind: EngineKindValue;
  simId: string;
  envelope: SimEnvelope;
  /** Vanilla Zustand store (use `useStore(instance.store, sel)` in React). */
  store: StoreApi<TState>;
  /** The SHARED Verdict service applied to the current state. */
  getVerdict(): Verdict;
  /** True once a terminal/complete state is reached. */
  isComplete(): boolean;
  /** Resolve an i18n key → display string in the active locale. */
  t(key: string): string;
  /** Subscribe to emitted xAPI telemetry statements. Returns an unsubscribe. */
  onTelemetry(cb: TelemetrySink): () => void;
  /** Restart the attempt (new attempt id + fresh state). */
  reset(): void;
}
