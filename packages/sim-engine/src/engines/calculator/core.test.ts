import { type CalculatorSpec, calculatorExample, validateSpec } from '@redex/sim-schemas';
import type { XapiTelemetryEvent } from '@redex/sim-schemas';
import { describe, it, expect } from 'vitest';
import { createCalculatorSim } from './core';

const SPEC = validateSpec(calculatorExample) as unknown as CalculatorSpec;

function harness() {
  const events: XapiTelemetryEvent[] = [];
  let n = 0;
  const inst = createCalculatorSim(SPEC, {
    telemetrySink: (e) => {
      events.push(e);
    },
    genUuid: () => `uuid-${n++}`,
    now: () => '2026-05-31T00:00:00.000Z',
  });
  return { inst, events };
}

describe('calculator engine — Verdict + thresholds + telemetry', () => {
  it('default inputs (12V/0.5A/150ft/1.6Ω → 11.76V) PASS — holds + good margin', () => {
    const { inst } = harness();
    expect(inst.compute()).toBeCloseTo(11.76);
    const v = inst.submit();
    expect(v.outcome).toBe('pass');
    expect(v.safety_veto_triggered).toBe(false);
    expect(v.state.token).toBe('pass');
  });

  it('a long, thin run drops below the lock hold voltage → SAFETY VETO (non-overridable)', () => {
    const { inst } = harness();
    inst.setInput('length_ft', 500);
    inst.setInput('ohms_per_1000ft', 6.4); // ~24AWG
    expect(inst.compute()).toBeCloseTo(8.8);
    const v = inst.submit();
    expect(v.kind).toBe('safety_veto');
    expect(v.safety_veto_triggered).toBe(true);
    expect(v.outcome).toBe('fail');
  });

  it('fail-closed: a safety_flag threshold in a warn band STILL vetoes (defense in depth)', () => {
    // The schema forbids authoring a safety_flag 'warn' band, but the runtime must
    // ALSO never silently drop a safety threshold by band — a warn band is otherwise
    // advisory/excluded from scoring. A misconfigured spec that reached the engine
    // must fail closed rather than bypass the non-overridable veto.
    const mutated = JSON.parse(JSON.stringify(SPEC)) as CalculatorSpec;
    const safety = mutated.thresholds.find((t) => t.safety_flag)!;
    safety.band = 'warn'; // demote the lock-holds safety threshold to advisory
    const inst = createCalculatorSim(mutated, {
      genUuid: () => 'uuid-0',
      now: () => '2026-05-31T00:00:00.000Z',
    });
    inst.setInput('length_ft', 500);
    inst.setInput('ohms_per_1000ft', 6.4); // → 8.8V, below the 10.5 hold
    const v = inst.submit();
    expect(v.safety_veto_triggered).toBe(true);
    expect(v.outcome).toBe('fail');
  });

  it('a thin-but-holding run (≥10.5 < 11.4) fails on margin but does NOT veto', () => {
    const { inst } = harness();
    // 12V, 1.2A, 300ft, 6.4Ω → drop = 1.2*2*0.3*6.4 = 4.608 → 7.39V (veto) — pick a milder one:
    inst.setInput('current_a', 0.8);
    inst.setInput('length_ft', 250);
    inst.setInput('ohms_per_1000ft', 3.0); // ~16AWG; drop = 0.8*2*0.25*3 = 1.2 → 10.8V
    expect(inst.compute()).toBeCloseTo(10.8);
    const v = inst.submit();
    expect(v.safety_veto_triggered).toBe(false); // 10.8 ≥ 10.5 hold
    expect(v.outcome).toBe('fail'); // 10.8 < 11.4 good-margin
  });

  it('matchedBands reflects which bands the current result lands in', () => {
    const { inst } = harness();
    expect(inst.matchedBands().map((b) => b.id)).toContain('good-margin'); // 11.76 ≥ 11.4
  });

  it('is deterministic — same inputs → identical verdict score across instances', () => {
    const a = harness().inst.getVerdict();
    const b = harness().inst.getVerdict();
    expect(a.score.scaled).toBe(b.score.scaled);
    expect(a.safety_score).toBe(b.safety_score);
  });

  it('emits attempted → answered → completed (+ triggeredSafetyVeto on a veto)', () => {
    const { inst, events } = harness();
    inst.setInput('length_ft', 500);
    inst.setInput('ohms_per_1000ft', 6.4);
    inst.submit();
    const verbs = events.map((e) => e.verb.id);
    expect(verbs[0]).toContain('attempted');
    expect(verbs).toContain('http://adlnet.gov/expapi/verbs/answered');
    expect(verbs.some((v) => v.includes('triggered-safety-veto'))).toBe(true);
    expect(verbs.some((v) => v.includes('completed'))).toBe(true);
    // every event carries a client_event_uuid (idempotency key, inv.4)
    expect(events.every((e) => typeof e.client_event_uuid === 'string')).toBe(true);
  });
});
