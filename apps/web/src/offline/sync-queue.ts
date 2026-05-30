import { type SyncEvent, validateSyncEvent } from '@redex/sync-core';
import { type AcademyOfflineDB, type QueuedEvent, db as defaultDb } from './db';

export interface SyncResult {
  accepted: string[];
  rejected: { client_event_uuid: string; reason: string }[];
}

/**
 * Enqueue an offline event. Idempotent on client_event_uuid (Dexie put-by-PK):
 * re-enqueuing the same fact does NOT create a duplicate. Refuses to queue an
 * illegal server-only write client-side (defense in depth; /sync rejects too).
 */
export async function enqueue(event: SyncEvent, db: AcademyOfflineDB = defaultDb): Promise<void> {
  const verdict = validateSyncEvent(event);
  if (!verdict.ok) {
    throw new Error(`refusing to queue illegal sync event (${verdict.reason}) — never fake a pass`);
  }
  const row: QueuedEvent = {
    client_event_uuid: event.client_event_uuid,
    device_ts: event.device_ts,
    table: event.table,
    op: event.op,
    payload: event.payload,
    status: 'queued',
    created_at: Date.now(),
  };
  await db.events.put(row); // put-by-PK → idempotent enqueue (no local double-count)
}

export async function pendingCount(db: AcademyOfflineDB = defaultDb): Promise<number> {
  return db.events.where('status').equals('queued').count();
}

/** Count of events the server REFUSED (e.g. RLS/ownership, server-only field).
 *  Surfaced in the UI — an un-synced/refused job must never look done (INT-102). */
export async function rejectedCount(db: AcademyOfflineDB = defaultDb): Promise<number> {
  return db.events.where('status').equals('rejected').count();
}

export async function rejectedEvents(db: AcademyOfflineDB = defaultDb): Promise<QueuedEvent[]> {
  return db.events.where('status').equals('rejected').toArray();
}

/**
 * Flush queued events to `/sync`. Sends the SAME client_event_uuid every time; the
 * server upserts ON CONFLICT DO NOTHING, so a DOUBLE-FLUSH (flaky reconnect /
 * background sync firing twice) cannot double-count. Accepted events are marked
 * synced; rejected events are marked rejected with the reason (surfaced, never
 * silently dropped). Returns the server result.
 */
export async function flush(
  syncUrl: string,
  opts: { token?: string; fetchImpl?: typeof fetch; db?: AcademyOfflineDB } = {},
): Promise<SyncResult> {
  const db = opts.db ?? defaultDb;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const queued = await db.events.where('status').equals('queued').toArray();
  if (queued.length === 0) return { accepted: [], rejected: [] };

  const events: SyncEvent[] = queued.map((q) => ({
    client_event_uuid: q.client_event_uuid,
    device_ts: q.device_ts,
    table: q.table,
    op: q.op,
    payload: q.payload,
  }));

  const res = await fetchImpl(syncUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: JSON.stringify({ events }),
  });
  if (!res.ok) throw new Error(`/sync failed: ${res.status}`);
  const result = (await res.json()) as SyncResult;

  await db.transaction('rw', db.events, async () => {
    for (const uuid of result.accepted ?? []) {
      await db.events.update(uuid, { status: 'synced' });
    }
    for (const r of result.rejected ?? []) {
      await db.events.update(r.client_event_uuid, { status: 'rejected', reason: r.reason });
    }
  });
  return result;
}
