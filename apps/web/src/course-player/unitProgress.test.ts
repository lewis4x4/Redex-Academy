import { validateSyncEvent, type SyncEvent } from '@redex/sync-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the offline queue: capture what recordUnitProgress enqueues, and let the real
// validateSyncEvent be the judge (the queue's enqueue() uses the same validator, so a
// mock that runs it mirrors production exactly).
const h = vi.hoisted(() => ({ enqueued: [] as SyncEvent[] }));
vi.mock('../offline/sync-queue', () => ({
  enqueue: vi.fn(async (e: SyncEvent) => {
    const v = validateSyncEvent(e);
    if (!v.ok) throw new Error(`refused (${v.reason})`);
    h.enqueued.push(e);
  }),
}));
vi.mock('../auth/supabaseClient', () => ({ supabase: { schema: () => ({}) } }));

import { recordUnitProgress } from './unitProgress';

const FIXED = { enrollmentId: 'enr-1', unitId: 'unit-1', orgId: 'org-1' } as const;
let seq = 0;
const genUuid = () => `00000000-0000-0000-0000-${String(++seq).padStart(12, '0')}`;
const now = () => '2026-05-31T00:00:00.000Z';

describe('recordUnitProgress — unit_progress via the offline sync-queue', () => {
  beforeEach(() => {
    h.enqueued.length = 0;
    seq = 0;
  });

  it('builds a valid upsert SyncEvent with BOTH conflict keys (enrollment_id, unit_id)', async () => {
    const event = await recordUnitProgress({
      ...FIXED,
      status: 'passed',
      score: 0.95,
      attempts: 2,
      genUuid,
      now,
    });
    expect(event.table).toBe('unit_progress');
    expect(event.op).toBe('upsert');
    // both conflict keys present (or validateSyncEvent → missing_conflict_key)
    expect(event.payload.enrollment_id).toBe('enr-1');
    expect(event.payload.unit_id).toBe('unit-1');
    expect(event.payload.status).toBe('passed');
    expect(event.payload.score).toBe(0.95);
    expect(event.payload.attempts).toBe(2);
    // the real validator accepts it as an upsert
    const verdict = validateSyncEvent(event);
    expect(verdict.ok).toBe(true);
    expect(verdict.classification).toBe('upsert');
    // it was actually queued
    expect(h.enqueued).toHaveLength(1);
  });

  it('omits score for lesson/signoff_prep completions (educational, score-less)', async () => {
    const event = await recordUnitProgress({ ...FIXED, status: 'passed', genUuid, now });
    expect('score' in event.payload).toBe(false);
    expect(event.payload.attempts).toBe(1);
    expect(validateSyncEvent(event).ok).toBe(true);
  });

  it('REFUSES a server-only field (never fake a pass / never confer authority)', async () => {
    // A server-only field on the same upsert must be rejected by the validator — and so
    // enqueue() (which runs the same validator) throws, matching production defense.
    const bad: SyncEvent = {
      client_event_uuid: '00000000-0000-0000-0000-000000000999',
      device_ts: now(),
      table: 'unit_progress',
      op: 'upsert',
      payload: {
        enrollment_id: 'enr-1',
        unit_id: 'unit-1',
        org_id: 'org-1',
        status: 'passed',
        proof: 'fake', // SERVER_ONLY_FIELD → must be refused
      },
    };
    const verdict = validateSyncEvent(bad);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('server_only_field');
  });

  it('REFUSES an upsert missing a conflict key (missing_conflict_key)', async () => {
    const noUnit: SyncEvent = {
      client_event_uuid: '00000000-0000-0000-0000-000000000998',
      device_ts: now(),
      table: 'unit_progress',
      op: 'upsert',
      payload: { enrollment_id: 'enr-1', org_id: 'org-1', status: 'passed' }, // no unit_id
    };
    const verdict = validateSyncEvent(noUnit);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('missing_conflict_key');
  });
});
