import 'fake-indexeddb/auto';
import { loadSpec, type TelemetrySink } from '@redex/sim-engine';
import { branchingExample } from '@redex/sim-schemas';
import { describe, expect, it } from 'vitest';
import { AcademyOfflineDB } from '../offline/db';
import { enqueueXapi, pendingXapiCount } from '../offline/xapi-queue';

describe('F5 telemetry queues offline via F4 (the F4↔F5 contract)', () => {
  it('running a sim enqueues xAPI statements to the F4 offline queue, keyed by client_event_uuid', async () => {
    const db = new AcademyOfflineDB('forge-telemetry-test');
    const pending: Promise<void>[] = [];
    const sink: TelemetrySink = (e) => {
      pending.push(
        enqueueXapi(
          {
            id: e.client_event_uuid,
            statement: e as unknown as Record<string, unknown>,
            device_ts: e.timestamp ?? '2026-05-29T00:00:00.000Z',
          },
          db,
        ),
      );
    };

    let n = 0;
    const sim = loadSpec(branchingExample, {
      telemetrySink: sink,
      genUuid: () => `00000000-0000-4000-8000-${String(n++).padStart(12, '0')}`,
      context: { offline: true },
    });
    if (sim.engineKind !== 'branching_scenario') throw new Error('expected branching');

    sim.choose('begin');
    sim.choose('faillocked'); // → safety-veto terminal (emits answered + veto + completed)
    await Promise.all(pending);

    expect(await pendingXapiCount(db)).toBeGreaterThan(0);
    const queued = await db.xapi.toArray();
    // Every queued statement carries the client_event_uuid idempotency key.
    expect(
      queued.every(
        (q) =>
          typeof (q.statement as { client_event_uuid?: unknown }).client_event_uuid === 'string',
      ),
    ).toBe(true);
    // The safety-veto statement reached the offline queue.
    const verbs = queued.map((q) => (q.statement as { verb?: { id?: string } }).verb?.id);
    expect(verbs).toContain('https://academy.goredex.com/xapi/verbs/triggered-safety-veto');
  });
});
