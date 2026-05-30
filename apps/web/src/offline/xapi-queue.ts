import { type AcademyOfflineDB, type QueuedXapiStatement, db as defaultDb } from './db';

/**
 * Queue an xAPI statement offline. F4 OWNS ONLY the durable local queue — the
 * actual LRS forwarding (the xAPI→LRS bridge) is M8. Idempotent on the statement
 * `id` (Dexie put-by-PK): re-queuing the same statement does not duplicate it, so
 * a flaky offline emitter can't inflate telemetry. Every statement carries the
 * client-generated id + a device timestamp (the offline-fact contract).
 */
export async function enqueueXapi(
  stmt: { id: string; statement: Record<string, unknown>; device_ts: string },
  db: AcademyOfflineDB = defaultDb,
): Promise<void> {
  const row: QueuedXapiStatement = {
    id: stmt.id,
    statement: stmt.statement,
    device_ts: stmt.device_ts,
    status: 'queued',
    created_at: Date.now(),
  };
  await db.xapi.put(row); // put-by-PK → idempotent enqueue
}

export async function pendingXapiCount(db: AcademyOfflineDB = defaultDb): Promise<number> {
  return db.xapi.where('status').equals('queued').count();
}

/** The queued statements awaiting the M8 bridge (oldest first). */
export async function pendingXapi(
  db: AcademyOfflineDB = defaultDb,
): Promise<QueuedXapiStatement[]> {
  return db.xapi.where('status').equals('queued').sortBy('created_at');
}
