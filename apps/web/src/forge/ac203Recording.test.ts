import { validateSyncEvent } from '@redex/sync-core';
import { describe, expect, it } from 'vitest';
import { AC203_SIM_DEFINITION_ID, buildAttemptEvents } from './ac203Recording';

function det() {
  let n = 0;
  return {
    genUuid: () => `00000000-0000-4000-8000-${String(n++).padStart(12, '0')}`,
    now: () => '2026-05-30T00:00:00.000Z',
  };
}

const base = {
  userId: '00000000-0000-0000-0000-0000000000c3',
  orgId: '00000000-0000-0000-0000-0000000000a1',
  simDefinitionId: AC203_SIM_DEFINITION_ID,
};

describe('AC-203 attempt recording → offline SyncEvents (F4 /sync)', () => {
  it('a PASS builds an attempt-first batch, every event a legal append-only sync event', () => {
    const events = buildAttemptEvents({
      ...base,
      choices: ['failsafe', 'pushtoexit', 'mount_reachable', 'facp', 'document'],
      verdict: {
        outcome: 'pass',
        safety_veto_triggered: false,
        score: { scaled: 1, raw: 3, max: 3 },
      },
      online: true,
      ...det(),
    });

    const [attempt, ...telemetry] = events;
    if (!attempt) throw new Error('expected an attempt event');

    // the attempt row is FIRST (so telemetry's parent-owned RLS is satisfied on /sync)
    expect(attempt.table).toBe('sim_attempts');
    expect(attempt.op).toBe('append');
    expect(attempt.payload.outcome).toBe('pass');
    expect(attempt.payload.safety_veto_triggered).toBe(false);
    expect(attempt.payload.offline_origin).toBe(false);
    expect(attempt.payload.user_id).toBe(base.userId);
    expect(attempt.payload.org_id).toBe(base.orgId);
    expect(attempt.payload.sim_definition_id).toBe(AC203_SIM_DEFINITION_ID);

    // one telemetry row per choice, all linked to the client-generated attempt id
    expect(telemetry).toHaveLength(5);
    expect(telemetry.every((e) => e.table === 'sim_telemetry_events')).toBe(true);
    expect(telemetry.every((e) => e.payload.sim_attempt_id === attempt.payload.id)).toBe(true);

    // every event is a legal append-only sync event (no server-only field, op=append),
    // and every client_event_uuid is distinct (idempotent, no collision within a table)
    const uuids = new Set<string>();
    for (const e of events) {
      const v = validateSyncEvent(e);
      expect(v.ok).toBe(true);
      expect(v.classification).toBe('append_only');
      expect(uuids.has(e.client_event_uuid)).toBe(false);
      uuids.add(e.client_event_uuid);
    }
  });

  it('a SAFETY VETO records outcome fail + safety_veto_triggered=true (the Do log, not a pass)', () => {
    const events = buildAttemptEvents({
      ...base,
      choices: ['faillocked'],
      verdict: {
        outcome: 'fail',
        safety_veto_triggered: true,
        score: { scaled: 0, raw: 0, max: 0 },
      },
      online: true,
      ...det(),
    });
    const attempt = events[0];
    if (!attempt) throw new Error('expected an attempt event');
    expect(attempt.payload.outcome).toBe('fail');
    expect(attempt.payload.safety_veto_triggered).toBe(true);
  });

  it('an OFFLINE completion stamps offline_origin=true (reconciles on reconnect; never a faked pass)', () => {
    const events = buildAttemptEvents({
      ...base,
      choices: ['failsafe', 'pushtoexit', 'mount_reachable', 'facp', 'document'],
      verdict: {
        outcome: 'pass',
        safety_veto_triggered: false,
        score: { scaled: 1, raw: 3, max: 3 },
      },
      online: false,
      ...det(),
    });
    const attempt = events[0];
    if (!attempt) throw new Error('expected an attempt event');
    expect(attempt.payload.offline_origin).toBe(true);
    // the batch only ever touches the append-only "Do" tables — promotion
    // (competency_state) is server-only, so no pass can be minted offline.
    expect(
      events.every((e) => e.table === 'sim_attempts' || e.table === 'sim_telemetry_events'),
    ).toBe(true);
  });
});
