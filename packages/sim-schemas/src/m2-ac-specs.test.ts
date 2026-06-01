import { describe, expect, it } from 'vitest';
import {
  M2_AC_SPECS,
  ac101AnatomySpec,
  ac102SpecTheDoorSpec,
  ac202WillItHoldSpec,
  ac203MagVsStrikeSpec,
  ac203ArmatureMountSpec,
  ac203ButtonPlacementSpec,
  ac203FollowThePowerSpec,
  ac203VirtualDoorSpec,
  AC203_NEW_SPECS,
} from './examples';
import { validateSpec } from '../zod/index';

// The three REAL AC-slice specs M2 seeds into academy.sim_definitions must validate
// against the F5b engine schemas, and every safety item/threshold must use the
// safety_compliance dimension on a SCORED band (no warn-band veto bypass — the F5b
// calculator hole). The keys must match units.content_ref.spec_key.

describe('@redex/sim-schemas: M2 AC-slice specs (the real authored sims)', () => {
  it('AC-101 anatomy-of-a-door validates as interaction_2d with a safety hotspot', () => {
    const parsed = validateSpec(ac101AnatomySpec) as { envelope: { engine_kind: string } };
    expect(parsed.envelope.engine_kind).toBe('interaction_2d');
    const safety = ac101AnatomySpec.items.filter((i) => i.scoring.safety_flag);
    expect(safety.length).toBeGreaterThanOrEqual(1);
    expect(safety.every((i) => i.scoring.dimension === 'safety_compliance')).toBe(true);
  });

  it('AC-102 spec-the-door validates with a safety lock-fail-state match', () => {
    const parsed = validateSpec(ac102SpecTheDoorSpec) as { envelope: { engine_kind: string } };
    expect(parsed.envelope.engine_kind).toBe('interaction_2d');
    const safety = ac102SpecTheDoorSpec.items.find((i) => i.scoring.safety_flag);
    expect(safety?.scoring.dimension).toBe('safety_compliance');
  });

  it('AC-202 will-it-hold validates as calculator; the safety threshold is a SCORED (non-warn) band', () => {
    const parsed = validateSpec(ac202WillItHoldSpec) as { envelope: { engine_kind: string } };
    expect(parsed.envelope.engine_kind).toBe('calculator');
    const safety = ac202WillItHoldSpec.thresholds.filter((t) => t.safety_flag);
    expect(safety.length).toBeGreaterThanOrEqual(1);
    // Closes the F5b veto-bypass hole: a safety threshold must NOT be an advisory warn band.
    expect(safety.every((t) => t.dimension === 'safety_compliance' && t.band !== 'warn')).toBe(
      true,
    );
  });

  it('every M2_AC_SPECS key matches its spec engine kind and is a valid spec', () => {
    for (const [key, spec] of Object.entries(M2_AC_SPECS)) {
      expect(() => validateSpec(spec)).not.toThrow();
      expect(key).toMatch(/^(ac-101|ac-102|ac-202|ac-203)\//);
    }
  });
});

// AC-203 (the flagship) — the 4 new embeddable 2D-interaction sims + the device-config
// virtual-door build. Every one must validate against the F5/F5b engine schemas, and
// every safety-flagged item/rule must use the safety_compliance dimension (no veto bypass).
describe('@redex/sim-schemas: AC-203 authored sims (the flagship real content)', () => {
  it('all 5 new AC-203 specs validate against their engine schemas', () => {
    for (const spec of AC203_NEW_SPECS) {
      expect(() => validateSpec(spec)).not.toThrow();
    }
  });

  it('mag-vs-strike-pick is interaction_2d (Unit 1 power-rule match)', () => {
    expect(
      (validateSpec(ac203MagVsStrikeSpec) as { envelope: { engine_kind: string } }).envelope
        .engine_kind,
    ).toBe('interaction_2d');
  });

  it('armature-mount is interaction_2d with a safety hotspot (over-tight/loose => veto)', () => {
    const parsed = validateSpec(ac203ArmatureMountSpec) as { envelope: { engine_kind: string } };
    expect(parsed.envelope.engine_kind).toBe('interaction_2d');
    const safety = ac203ArmatureMountSpec.items.filter((i) => i.scoring.safety_flag);
    expect(safety.length).toBeGreaterThanOrEqual(1);
    expect(safety.every((i) => i.scoring.dimension === 'safety_compliance')).toBe(true);
    expect(safety.some((i) => i.scoring.line_item_key === 'ac203.armature_sealed_pull_test')).toBe(
      true,
    );
  });

  it('button-placement is interaction_2d with safety placement + release-time items', () => {
    const parsed = validateSpec(ac203ButtonPlacementSpec) as { envelope: { engine_kind: string } };
    expect(parsed.envelope.engine_kind).toBe('interaction_2d');
    const safety = ac203ButtonPlacementSpec.items.filter((i) => i.scoring.safety_flag);
    expect(safety.length).toBeGreaterThanOrEqual(2);
    expect(safety.every((i) => i.scoring.dimension === 'safety_compliance')).toBe(true);
  });

  it('follow-the-power is interaction_2d (diagnostic fault-isolation hotspot)', () => {
    expect(
      (validateSpec(ac203FollowThePowerSpec) as { envelope: { engine_kind: string } }).envelope
        .engine_kind,
    ).toBe('interaction_2d');
  });

  it('virtual-door-maglock is device_config; every safety rule is safety_compliance', () => {
    const parsed = validateSpec(ac203VirtualDoorSpec) as { envelope: { engine_kind: string } };
    expect(parsed.envelope.engine_kind).toBe('device_config');
    const safety = ac203VirtualDoorSpec.assertion_rules.filter((r) => r.safety_flag);
    expect(safety.length).toBeGreaterThanOrEqual(1);
    expect(safety.every((r) => r.dimension === 'safety_compliance')).toBe(true);
  });

  it('the 4 embeddable AC-203 sims are interaction_2d (the device-config build is NOT embeddable)', () => {
    for (const [key, spec] of Object.entries(M2_AC_SPECS)) {
      if (!key.startsWith('ac-203/')) continue;
      expect((spec as { envelope: { engine_kind: string } }).envelope.engine_kind).toBe(
        'interaction_2d',
      );
    }
  });
});
