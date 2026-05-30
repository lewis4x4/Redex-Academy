import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { AcademyOfflineDB } from './db';
import { enqueueXapi, pendingXapi, pendingXapiCount } from './xapi-queue';

let n = 0;
const freshDb = () => new AcademyOfflineDB(`xapi-test-${n++}`);
const stmt = (id: string) => ({
  id,
  statement: { verb: { id: 'http://adlnet.gov/expapi/verbs/attempted' } },
  device_ts: '2026-05-29T00:00:00.000Z',
});

describe('offline xAPI queue (F4 queues; M8 forwards)', () => {
  it('queues statements durably for the M8 bridge', async () => {
    const db = freshDb();
    await enqueueXapi(stmt('00000000-0000-0000-0000-00000000aa01'), db);
    expect(await pendingXapiCount(db)).toBe(1);
    expect((await pendingXapi(db))[0]?.statement).toBeTruthy();
  });

  it('is idempotent on statement id (a flaky emitter cannot inflate telemetry)', async () => {
    const db = freshDb();
    const s = stmt('00000000-0000-0000-0000-00000000aa02');
    await enqueueXapi(s, db);
    await enqueueXapi(s, db); // same statement re-queued
    expect(await pendingXapiCount(db)).toBe(1);
  });
});
