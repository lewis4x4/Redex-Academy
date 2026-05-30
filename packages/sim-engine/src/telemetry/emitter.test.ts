import { XapiTelemetryEvent } from '@redex/sim-schemas';
import type { XapiTelemetryEvent as XapiEvent } from '@redex/sim-schemas';
import { describe, expect, it } from 'vitest';
import { createEmitter, resultFromVerdict } from './emitter';

const deps = (sink?: (e: XapiEvent) => void) => {
  let n = 0;
  return {
    simId: 'ac203.test',
    engineKind: 'branching_scenario' as const,
    actor: { homePage: 'https://academy.goredex.com', name: 'user-1' },
    context: {
      org_id: '00000000-0000-0000-0000-0000000000a1',
      registration: '00000000-0000-0000-0000-0000000000b2',
      offline: true,
    },
    sink,
    genUuid: () => `00000000-0000-4000-8000-${String(n++).padStart(12, '0')}`,
    now: () => '2026-05-29T00:00:00.000Z',
  };
};

describe('shared xAPI telemetry emitter', () => {
  it('builds a valid envelope xAPI statement with a client_event_uuid', () => {
    const em = createEmitter(deps());
    const e = em.emit({ verb: em.verbs.attempted, objectId: 'arrival' });
    expect(() => XapiTelemetryEvent.parse(e)).not.toThrow();
    expect(e.client_event_uuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(e.verb.id).toBe('http://adlnet.gov/expapi/verbs/attempted');
    expect(e.object.id).toContain('ac203.test');
    expect(e.context?.extensions?.['https://academy.goredex.com/xapi/ext/engine_kind']).toBe(
      'branching_scenario',
    );
  });

  it('every statement gets a fresh uuid (idempotency key per event)', () => {
    const em = createEmitter(deps());
    const a = em.emit({ verb: em.verbs.answered });
    const b = em.emit({ verb: em.verbs.answered });
    expect(a.client_event_uuid).not.toBe(b.client_event_uuid);
  });

  it('pushes to the sink and supports subscribe/unsubscribe', () => {
    const got: XapiEvent[] = [];
    const em = createEmitter(
      deps((e) => {
        got.push(e);
      }),
    );
    em.emit({ verb: em.verbs.attempted });
    const got2: XapiEvent[] = [];
    const off = em.subscribe((e) => {
      got2.push(e);
    });
    em.emit({ verb: em.verbs.answered });
    off();
    em.emit({ verb: em.verbs.completed });
    expect(got).toHaveLength(3); // primary sink saw all three
    expect(got2).toHaveLength(1); // extra subscriber saw only while subscribed
  });

  it('resultFromVerdict maps safety_veto_triggered into result.extensions', () => {
    const r = resultFromVerdict({
      outcome: 'fail',
      safety_veto_triggered: true,
      score: { scaled: 0, raw: 0, max: 9 },
    });
    expect(r.success).toBe(false);
    expect(r.extensions?.['https://academy.goredex.com/xapi/ext/safety_veto_triggered']).toBe(true);
  });
});
