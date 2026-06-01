/**
 * AC-203 (the flagship) — verdict tests for the "virtual door" device-config build
 * (Unit 6: wire the mag + REX + push-to-exit and prove both release paths). Proves
 * pass / fail / safety-veto (DoD §8.2). The push-to-exit must cut mag power directly
 * and both release paths must be proven — wrong on either is a NON-overridable veto.
 * No fixture (fixture_set_ref: null) — the build is schematic, not a recorded fixture.
 */
import { ac203VirtualDoorSpec } from '@redex/sim-schemas';
import { describe, expect, it } from 'vitest';
import { loadSpec } from '../../loadSpec';

function makeSim() {
  let n = 0;
  const sim = loadSpec(ac203VirtualDoorSpec, {
    genUuid: () => `00000000-0000-4000-8000-${String(n++).padStart(12, '0')}`,
    now: () => '2026-06-01T00:00:00.000Z',
  });
  if (sim.engineKind !== 'device_config') throw new Error('expected device_config');
  return sim;
}

const correctBuild = (sim: ReturnType<typeof makeSim>) => {
  sim.setField('mag_black', 'v24_supply');
  sim.setField('mag_red', 'controller_nc');
  sim.setField('rex_input', 'controller_input');
  sim.setField('push_to_exit_wiring', 'inline_mag_power');
  sim.setField('prove_power_loss', true);
};

describe('engine #2 device-config — AC-203 virtual-door mag-lock build', () => {
  it('a correct fail-safe build with both release paths proven → PASS, no veto', () => {
    const sim = makeSim();
    correctBuild(sim);
    const v = sim.submit();
    expect(v.outcome).toBe('pass');
    expect(v.safety_veto_triggered).toBe(false);
  });

  it('push-to-exit NOT in-line in the mag power → SAFETY VETO', () => {
    const sim = makeSim();
    correctBuild(sim);
    sim.setField('push_to_exit_wiring', 'controller_input_only'); // does not cut mag power directly
    const v = sim.submit();
    expect(v.kind).toBe('safety_veto');
    expect(v.outcome).toBe('fail');
    expect(v.safety_veto_triggered).toBe(true);
  });

  it('release paths NOT proven → SAFETY VETO', () => {
    const sim = makeSim();
    correctBuild(sim);
    sim.setField('prove_power_loss', false);
    const v = sim.submit();
    expect(v.safety_veto_triggered).toBe(true);
    expect(v.outcome).toBe('fail');
  });

  it('a non-safety wiring mistake (Black not on 24V) fails WITHOUT a veto', () => {
    const sim = makeSim();
    correctBuild(sim);
    sim.setField('mag_black', 'controller_nc'); // fail-safe-wiring (technical) now fails
    const v = sim.submit();
    expect(v.outcome).toBe('fail');
    expect(v.safety_veto_triggered).toBe(false);
  });
});
