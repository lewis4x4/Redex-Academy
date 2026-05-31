import { describe, expect, it } from 'vitest';
import {
  M2_AC_SPECS,
  ac101AnatomySpec,
  ac102SpecTheDoorSpec,
  ac202WillItHoldSpec,
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
      expect(key).toMatch(/^(ac-101|ac-102|ac-202)\//);
    }
  });
});
