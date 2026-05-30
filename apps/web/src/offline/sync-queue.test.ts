import 'fake-indexeddb/auto';
import type { SyncEvent } from '@redex/sync-core';
import { describe, expect, it } from 'vitest';
import { AcademyOfflineDB } from './db';
import { enqueue, flush, pendingCount, rejectedCount } from './sync-queue';

let dbN = 0;
const freshDb = () => new AcademyOfflineDB(`test-${dbN++}`);
const U = (s: string) => `00000000-0000-0000-0000-${s.padStart(12, '0')}`;
const ev = (uuid: string, over: Partial<SyncEvent> = {}): SyncEvent => ({
  client_event_uuid: uuid,
  device_ts: '2026-05-29T00:00:00.000Z',
  table: 'sim_attempts',
  op: 'append',
  payload: {},
  ...over,
});
const parseBody = (init?: RequestInit) =>
  JSON.parse(String(init?.body)) as { events: { client_event_uuid: string }[] };

describe('offline sync queue', () => {
  it('enqueue is idempotent on client_event_uuid (no local double-count)', async () => {
    const db = freshDb();
    await enqueue(ev(U('1')), db);
    await enqueue(ev(U('1')), db); // same fact re-enqueued
    expect(await pendingCount(db)).toBe(1);
  });

  it('refuses to queue an illegal server-only write (never fake a pass)', async () => {
    const db = freshDb();
    await expect(
      enqueue(ev(U('2'), { table: 'signoffs', op: 'upsert', payload: { outcome: 'pass' } }), db),
    ).rejects.toThrow();
    expect(await pendingCount(db)).toBe(0);
  });

  it('flush sends queued events, marks them synced, and a double-flush sends stable uuids', async () => {
    const db = freshDb();
    await enqueue(ev(U('3')), db);
    await enqueue(
      ev(U('4'), { table: 'sim_telemetry_events', payload: { event_type: 'tap' } }),
      db,
    );

    const sentBatches: string[][] = [];
    const fakeFetch: typeof fetch = async (_input, init) => {
      const body = parseBody(init as RequestInit);
      sentBatches.push(body.events.map((e) => e.client_event_uuid));
      return new Response(
        JSON.stringify({ accepted: body.events.map((e) => e.client_event_uuid), rejected: [] }),
        { status: 200 },
      );
    };

    const r1 = await flush('https://x/sync', { fetchImpl: fakeFetch, db });
    expect(r1.accepted).toHaveLength(2);
    expect(await pendingCount(db)).toBe(0); // accepted → synced

    // A second flush (background sync fired again on a flaky network): nothing left
    // queued, so no re-send — and had it re-sent, the uuids are identical and the
    // server's ON CONFLICT DO NOTHING would dedupe (proven in the SQL test).
    const r2 = await flush('https://x/sync', { fetchImpl: fakeFetch, db });
    expect(r2.accepted).toHaveLength(0);
    expect(sentBatches[0]?.slice().sort()).toEqual([U('3'), U('4')].sort());
  });

  it('marks rejected events (surfaced, not silently dropped)', async () => {
    const db = freshDb();
    await enqueue(ev(U('5')), db);
    const fakeFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          accepted: [],
          rejected: [{ client_event_uuid: U('5'), reason: 'not_owner' }],
        }),
        {
          status: 200,
        },
      );
    await flush('https://x/sync', { fetchImpl: fakeFetch, db });
    const row = await db.events.get(U('5'));
    expect(row?.status).toBe('rejected');
    expect(row?.reason).toBe('not_owner');
    // Surfaced (not silently dropped): it leaves the queue but is counted rejected.
    expect(await pendingCount(db)).toBe(0);
    expect(await rejectedCount(db)).toBe(1);
  });
});
