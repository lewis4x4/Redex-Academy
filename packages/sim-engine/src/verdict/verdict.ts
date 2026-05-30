/**
 * The shared Verdict service (F5 §2 / DRY_RUN red flags). ONE service every engine
 * calls — never a per-engine reimplementation — so pass/fail/veto and the feedback
 * wording are identical and translatable across all six engines.
 *
 * The safety-veto here is the spec-level mirror of the DB trigger
 * academy.tg_signoff_compute_outcome (ledger §B / invariant 1): when
 * `veto_on_any_safety_failure` is true, a SINGLE safety-flagged failure forces
 * outcome=fail + safety_veto_triggered=true, non-overridable — it cannot be
 * outscored, regardless of the non-safety score. Never weaken this.
 */
import type { ColorblindSafeState } from '@redex/sim-schemas';
import type { RubricResult, Verdict } from '../api';
import { resolveStateToken } from '../colorblind/tokens';

export interface ScoringHook {
  pass_threshold: number;
  safety_pass_threshold: number;
  veto_on_any_safety_failure: boolean;
  veto_feedback_i18n?: string;
  veto_state?: ColorblindSafeState;
}

const sum = (rs: RubricResult[], k: 'awarded' | 'max') => rs.reduce((a, r) => a + r[k], 0);
const scaled = (rs: RubricResult[]) => {
  const max = sum(rs, 'max');
  // No items in a subset ⇒ that gate is vacuously satisfied (scaled 1).
  return max <= 0 ? 1 : Math.max(0, Math.min(1, sum(rs, 'awarded') / max));
};

export function computeVerdict(
  scoring: ScoringHook,
  results: RubricResult[],
  stateOverrides: readonly ColorblindSafeState[] = [],
  /**
   * Defense-in-depth: an engine may FORCE a veto from an authoritative out-of-band
   * safety signal (e.g. branching reached a terminal authored `safety_veto: true`),
   * independent of the rubric results. Honored regardless of veto_on_any_safety_failure.
   */
  opts: { forceSafetyVeto?: boolean } = {},
): Verdict {
  // Safety SUBSET (gated at safety_pass_threshold) = the safety_compliance
  // dimension. The VETO trigger = any safety_flag result that failed (the wrong
  // safety branch / failed safety assertion). A safety_flag result is always in
  // the safety_compliance dimension (enforced by the schemas).
  const safety = results.filter((r) => r.dimension === 'safety_compliance');
  const nonSafety = results.filter((r) => r.dimension !== 'safety_compliance');
  const failedSafety = results.filter((r) => r.safety_flag && !r.passed);
  const failed = results.filter((r) => !r.passed);

  const nonSafetyScaled = scaled(nonSafety);
  const safetyScaled = scaled(safety);
  const score = {
    scaled: nonSafetyScaled,
    raw: sum(nonSafety, 'awarded'),
    max: sum(nonSafety, 'max'),
  };

  // SAFETY VETO — a single safety failure ⇒ fail, non-overridable (cannot be outscored).
  // Also honor an engine-forced veto (e.g. a terminal authored safety_veto:true).
  if (opts.forceSafetyVeto || (scoring.veto_on_any_safety_failure && failedSafety.length > 0)) {
    return {
      kind: 'safety_veto',
      outcome: 'fail',
      safety_veto_triggered: true,
      score,
      safety_score: safetyScaled,
      failed,
      veto_feedback_i18n: scoring.veto_feedback_i18n,
      state: scoring.veto_state ?? resolveStateToken('safety_veto', stateOverrides),
    };
  }

  const pass =
    nonSafetyScaled >= scoring.pass_threshold && safetyScaled >= scoring.safety_pass_threshold;
  return {
    kind: pass ? 'pass' : 'fail',
    outcome: pass ? 'pass' : 'fail',
    safety_veto_triggered: false,
    score,
    safety_score: safetyScaled,
    failed,
    state: resolveStateToken(pass ? 'pass' : 'fail', stateOverrides),
  };
}
