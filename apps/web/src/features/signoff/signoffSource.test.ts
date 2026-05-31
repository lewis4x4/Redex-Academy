import { describe, expect, it } from 'vitest';
import { previewOutcome, type ScoredLine } from './signoffSource';

// The UI veto PREVIEW (layer 3) must agree with the DB trigger
// (academy.tg_signoff_compute_outcome, proven by supabase/tests/0001+0004) and the
// Edge-Fn layer (_shared/rubric.ts). Same cases, so a "looks like pass but the
// server rejects" mismatch can't happen.
const allTwos: ScoredLine[] = [
  { dimension: 'safety_compliance', is_critical_safety: true, score: 2 },
  { dimension: 'safety_compliance', is_critical_safety: true, score: 2 },
  { dimension: 'technical_execution', is_critical_safety: false, score: 2 },
  { dimension: 'verification_documentation', is_critical_safety: false, score: 2 },
  { dimension: 'independence_judgment', is_critical_safety: false, score: 2 },
];

describe('signoff UI veto preview (layer 3) mirrors the DB trigger', () => {
  it('all-2s ⇒ pass, no veto', () => {
    expect(previewOutcome(allTwos)).toEqual({ outcome: 'pass', safetyVeto: false });
  });

  it('a single critical-safety 0 ⇒ non-overridable fail (veto), even with everything else 3', () => {
    const lines = allTwos.map((l, i) => ({ ...l, score: i === 0 ? 0 : 3 }));
    expect(previewOutcome(lines)).toEqual({ outcome: 'fail', safetyVeto: true });
  });

  it('no line items ⇒ fail (cannot preview a pass with nothing scored)', () => {
    expect(previewOutcome([])).toEqual({ outcome: 'fail', safetyVeto: false });
  });

  it('a non-safety dimension below 2 ⇒ fail, but NOT a veto', () => {
    // index 2 is the technical_execution line — drop it below the threshold.
    const lines = allTwos.map((l, i) => ({ ...l, score: i === 2 ? 1 : l.score }));
    expect(previewOutcome(lines)).toEqual({ outcome: 'fail', safetyVeto: false });
  });

  it('a critical-safety line at 1 (not 0) ⇒ fail (safety subset < 2) but NOT a veto', () => {
    const lines = allTwos.map((l, i) => ({ ...l, score: i === 0 ? 1 : l.score }));
    expect(previewOutcome(lines)).toEqual({ outcome: 'fail', safetyVeto: false });
  });

  it('a score of 3 across the board passes (threshold ≥2, range 0..3)', () => {
    expect(previewOutcome(allTwos.map((l) => ({ ...l, score: 3 })))).toEqual({
      outcome: 'pass',
      safetyVeto: false,
    });
  });
});
