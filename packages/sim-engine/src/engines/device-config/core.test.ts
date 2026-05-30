import { aeroFixture, deviceConfigExample } from '@redex/sim-schemas';
import type { XapiTelemetryEvent as XapiEvent } from '@redex/sim-schemas';
import { describe, expect, it } from 'vitest';
import { loadSpec } from '../../loadSpec';

function makeSim(fixture: unknown = aeroFixture) {
  let n = 0;
  const events: XapiEvent[] = [];
  const sim = loadSpec(deviceConfigExample, {
    fixture,
    telemetrySink: (e) => {
      events.push(e);
    },
    genUuid: () => `00000000-0000-4000-8000-${String(n++).padStart(12, '0')}`,
    now: () => '2026-05-29T00:00:00.000Z',
  });
  if (sim.engineKind !== 'device_config') throw new Error('expected device_config');
  return { sim, events };
}

const correctConfig = (sim: ReturnType<typeof makeSim>['sim']) => {
  sim.setField('lock_output_mode', 'fail_safe');
  sim.setField('rex_input', 'rex_terminal');
  sim.setField('dps_input', 'dps_terminal');
  sim.setField('lock_polarity', 'normal');
  sim.setField('relay_logic', 'switch_lock_circuit');
  sim.setField('cloud_added', true);
};

describe('engine #2 device-config — Aero single-door runs end-to-end', () => {
  it('a correct commission → PASS, no safety veto', () => {
    const { sim, events } = makeSim();
    correctConfig(sim);
    const v = sim.submit();
    expect(v.outcome).toBe('pass');
    expect(v.safety_veto_triggered).toBe(false);
    expect(sim.isComplete()).toBe(true);
    expect(events.every((e) => typeof e.client_event_uuid === 'string')).toBe(true);
  });

  it('a fail-locked egress lock → SAFETY VETO (cannot be outscored by the rest)', () => {
    const { sim, events } = makeSim();
    correctConfig(sim);
    sim.setField('lock_output_mode', 'fail_locked'); // the safety_flag assertion now fails
    const v = sim.submit();
    expect(v.kind).toBe('safety_veto');
    expect(v.outcome).toBe('fail');
    expect(v.safety_veto_triggered).toBe(true);
    expect(v.failed.some((r) => r.ref === 'egress-fail-safe')).toBe(true);
    expect(events.map((e) => e.verb.id)).toContain(
      'https://academy.goredex.com/xapi/verbs/triggered-safety-veto',
    );
  });

  it('a non-safety mistake (REX/DPS swapped) fails WITHOUT a veto', () => {
    const { sim } = makeSim();
    correctConfig(sim);
    sim.setField('rex_input', 'dps_terminal');
    sim.setField('dps_input', 'rex_terminal');
    const v = sim.submit();
    expect(v.outcome).toBe('fail');
    expect(v.safety_veto_triggered).toBe(false);
    expect(v.failed.some((r) => r.ref === 'rex-dps-not-swapped')).toBe(true);
  });

  it('REFUSES to load an UNSANITIZED fixture (invariant 6 publish gate)', () => {
    expect(() => makeSim({ ...aeroFixture, sanitized: false })).toThrow(/not sanitized/);
  });

  it('rejects writing an unknown field', () => {
    const { sim } = makeSim();
    expect(() => sim.setField('ghost_field', 'x')).toThrow(/unknown field/);
  });
});
