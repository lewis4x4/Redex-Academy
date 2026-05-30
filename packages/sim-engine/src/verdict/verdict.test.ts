import { describe, expect, it } from 'vitest';
import type { RubricResult } from '../api';
import { computeVerdict, type ScoringHook } from './verdict';

const scoring: ScoringHook = {
  pass_threshold: 0.8,
  safety_pass_threshold: 0.9,
  veto_on_any_safety_failure: true,
};

const r = (over: Partial<RubricResult>): RubricResult => ({
  ref: 'x',
  dimension: 'technical_execution',
  safety_flag: false,
  awarded: 1,
  max: 1,
  passed: true,
  ...over,
});

describe('Verdict service: shared scoring + safety-veto (mirrors the DB rule)', () => {
  it('all checks pass → pass', () => {
    const v = computeVerdict(scoring, [r({}), r({ dimension: 'safety_compliance' })]);
    expect(v.kind).toBe('pass');
    expect(v.outcome).toBe('pass');
    expect(v.safety_veto_triggered).toBe(false);
    expect(v.state.token).toBe('pass');
  });

  it('a single safety-flagged failure VETOES → fail + safety_veto_triggered, non-overridable', () => {
    const v = computeVerdict(scoring, [
      r({ dimension: 'safety_compliance', safety_flag: true, passed: false, awarded: 0 }),
      // pile on passing non-safety points — must NOT be outscoreable
      ...Array.from({ length: 50 }, () => r({ passed: true })),
    ]);
    expect(v.kind).toBe('safety_veto');
    expect(v.outcome).toBe('fail');
    expect(v.safety_veto_triggered).toBe(true);
    expect(v.state.token).toBe('safety_veto');
    expect(v.state.shape).toBe('octagon');
  });

  it('veto can be disabled ONLY by veto_on_any_safety_failure=false (not for safety-gated content)', () => {
    const noVeto: ScoringHook = { ...scoring, veto_on_any_safety_failure: false };
    const v = computeVerdict(noVeto, [
      r({ dimension: 'safety_compliance', safety_flag: true, passed: false, awarded: 0, max: 1 }),
    ]);
    // no veto, but the safety subset score (0) is below safety_pass_threshold → still fail
    expect(v.safety_veto_triggered).toBe(false);
    expect(v.outcome).toBe('fail');
  });

  it('non-safety below pass_threshold → fail (no veto)', () => {
    const v = computeVerdict(scoring, [
      r({ passed: true, awarded: 1, max: 1 }),
      r({ passed: false, awarded: 0, max: 1 }),
      r({ passed: false, awarded: 0, max: 1 }),
    ]);
    expect(v.outcome).toBe('fail');
    expect(v.kind).toBe('fail');
    expect(v.score.scaled).toBeCloseTo(1 / 3);
  });

  it('safety subset below 0.9 → fail even if non-safety is perfect', () => {
    const v = computeVerdict(scoring, [
      r({ dimension: 'technical_execution', passed: true }),
      // safety subset: 8/10 = 0.8 < 0.9, but no single safety_flag failure → not a veto
      r({ dimension: 'safety_compliance', safety_flag: false, passed: true, awarded: 8, max: 10 }),
    ]);
    expect(v.outcome).toBe('fail');
    expect(v.safety_veto_triggered).toBe(false);
  });
});
