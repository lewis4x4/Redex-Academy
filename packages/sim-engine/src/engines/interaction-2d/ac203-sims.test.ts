/**
 * AC-203 (the flagship) — verdict tests for the 4 new 2D-interaction sims:
 * mag-vs-strike-pick, armature-mount, button-placement, follow-the-power.
 * Proves pass / fail / safety-veto for each (DoD §8.2). The over-tight (and loose)
 * armature seat must route through the NON-overridable safety veto, and a wrong
 * push-to-exit placement/hold likewise — these are the life-safety traps.
 */
import {
  type Interaction2dSpec,
  ac203MagVsStrikeSpec,
  ac203ArmatureMountSpec,
  ac203ButtonPlacementSpec,
  ac203FollowThePowerSpec,
  validateSpec,
} from '@redex/sim-schemas';
import { describe, it, expect } from 'vitest';
import { createInteraction2dSim } from './core';

const magVsStrike = validateSpec(ac203MagVsStrikeSpec) as unknown as Interaction2dSpec;
const armature = validateSpec(ac203ArmatureMountSpec) as unknown as Interaction2dSpec;
const button = validateSpec(ac203ButtonPlacementSpec) as unknown as Interaction2dSpec;
const followPower = validateSpec(ac203FollowThePowerSpec) as unknown as Interaction2dSpec;

function sim(spec: Interaction2dSpec) {
  let n = 0;
  return createInteraction2dSim(spec, {
    genUuid: () => `uuid-${n++}`,
    now: () => '2026-06-01T00:00:00.000Z',
  });
}

describe('AC-203 mag-vs-strike-pick (Unit 1, technical match)', () => {
  it('maglock→powered-to-lock, strike→powered-to-unlock → PASS', () => {
    const s = sim(magVsStrike);
    s.place('power-rule', 'd-maglock', 'r-powered-lock');
    s.place('power-rule', 'd-strike', 'r-powered-unlock');
    const v = s.submit();
    expect(v.outcome).toBe('pass');
    expect(v.safety_veto_triggered).toBe(false);
  });

  it('swapped power rules → FAIL (no veto — not a safety item)', () => {
    const s = sim(magVsStrike);
    s.place('power-rule', 'd-maglock', 'r-powered-unlock');
    s.place('power-rule', 'd-strike', 'r-powered-lock');
    const v = s.submit();
    expect(v.outcome).toBe('fail');
    expect(v.safety_veto_triggered).toBe(false);
  });
});

describe('AC-203 armature-mount (Unit 2, safety hotspot)', () => {
  it('seats floating on the rubber washers (sealed) → PASS', () => {
    const s = sim(armature);
    s.tap('seat-the-armature', 'sealed');
    const v = s.submit();
    expect(v.outcome).toBe('pass');
    expect(v.safety_veto_triggered).toBe(false);
  });

  it('torqued down solid (over-tight) → SAFETY VETO (the silent weak-hold failure)', () => {
    const s = sim(armature);
    s.tap('seat-the-armature', 'solid');
    const v = s.submit();
    expect(v.kind).toBe('safety_veto');
    expect(v.safety_veto_triggered).toBe(true);
    expect(v.outcome).toBe('fail');
  });

  it('left loose / under-seated → SAFETY VETO', () => {
    const s = sim(armature);
    s.tap('seat-the-armature', 'loose');
    const v = s.submit();
    expect(v.safety_veto_triggered).toBe(true);
    expect(v.outcome).toBe('fail');
  });
});

describe('AC-203 button-placement (Unit 3, safety placement + release time)', () => {
  it('in the 40–48in/≤5ft envelope AND held ≥30s → PASS', () => {
    const s = sim(button);
    s.tap('place-the-button', 'envelope');
    s.place('release-duration', 'hold-time', 'full-30s');
    const v = s.submit();
    expect(v.outcome).toBe('pass');
    expect(v.safety_veto_triggered).toBe(false);
  });

  it('mounted too high (out of reach) → SAFETY VETO', () => {
    const s = sim(button);
    s.tap('place-the-button', 'too_high');
    s.place('release-duration', 'hold-time', 'full-30s');
    const v = s.submit();
    expect(v.safety_veto_triggered).toBe(true);
    expect(v.outcome).toBe('fail');
  });

  it('a momentary release (re-locks) → SAFETY VETO', () => {
    const s = sim(button);
    s.tap('place-the-button', 'envelope');
    s.place('release-duration', 'hold-time', 'momentary');
    const v = s.submit();
    expect(v.safety_veto_triggered).toBe(true);
    expect(v.outcome).toBe('fail');
  });
});

describe('AC-203 follow-the-power (Unit 4, diagnostic hotspot)', () => {
  it('isolates the fault to the push-button wiring → PASS', () => {
    const s = sim(followPower);
    s.tap('isolate-the-fault', 'button');
    const v = s.submit();
    expect(v.outcome).toBe('pass');
    expect(v.safety_veto_triggered).toBe(false);
  });

  it('blames the mag itself → FAIL (no veto — diagnostic skill, not a safety trap)', () => {
    const s = sim(followPower);
    s.tap('isolate-the-fault', 'mag');
    const v = s.submit();
    expect(v.outcome).toBe('fail');
    expect(v.safety_veto_triggered).toBe(false);
  });
});
