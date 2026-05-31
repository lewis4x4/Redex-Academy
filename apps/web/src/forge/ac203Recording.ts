// M3 — turn a finished AC-203 branching attempt into the offline-reconcilable
// "Do" record (append-only sim_attempts + sim_telemetry_events SyncEvents) for the
// F4 /sync path. This is the rehearsal LOG; it is NOT the mastery gate. Promotion
// (competency_state) is server-only (invariant 3) via the finalize-sim-attempt
// Edge Function — a client cannot fake a pass by writing these rows, because the
// node only advances on a server-recomputed pass.
//
// Idempotent by construction: every row carries its own client_event_uuid, so a
// double-flush (ON CONFLICT DO NOTHING) cannot double-count. The attempt row is
// ordered BEFORE its telemetry so the telemetry RLS (parent-owned) is satisfied
// when /sync applies the batch in order.

import type { SyncEvent } from '@redex/sync-core';
import type { Verdict } from '@redex/sim-engine';

/**
 * The seeded academy.sim_definitions id for the AC-203 egress-fail branching sim
 * (seed/0001_mvp_slice_seed.sql). The attempt FKs to it and the finalize Edge
 * Function loads the authoritative spec by it. Keep in sync with the seed row.
 */
export const AC203_SIM_DEFINITION_ID = '000000d1-0000-0000-0000-00000000000e';

export interface BuildAttemptInput {
  userId: string;
  orgId: string;
  simDefinitionId: string;
  /** The ordered edge ids the learner chose (the path). */
  choices: string[];
  verdict: Pick<Verdict, 'outcome' | 'safety_veto_triggered' | 'score'>;
  /** Linked enrollment, if the learner is enrolled in the course (nullable). */
  enrollmentId?: string | null;
  /** False when the attempt completed offline (offline_origin). */
  online: boolean;
  genUuid: () => string;
  now: () => string;
}

/**
 * Build the append-only SyncEvents for a finished attempt: the sim_attempts summary
 * first, then one sim_telemetry_events row per branch choice. Pure + deterministic
 * (inject genUuid/now). Never includes a server-only field, so /sync + the offline
 * enqueue both accept it.
 */
export function buildAttemptEvents(input: BuildAttemptInput): SyncEvent[] {
  const attemptId = input.genUuid();
  const ts = input.now();

  const attempt: SyncEvent = {
    client_event_uuid: input.genUuid(),
    device_ts: ts,
    table: 'sim_attempts',
    op: 'append',
    payload: {
      id: attemptId, // client-generated so telemetry FK resolves within the offline batch
      user_id: input.userId,
      org_id: input.orgId,
      sim_definition_id: input.simDefinitionId,
      enrollment_id: input.enrollmentId ?? null,
      outcome: input.verdict.outcome,
      score: input.verdict.score.scaled,
      safety_veto_triggered: input.verdict.safety_veto_triggered,
      offline_origin: !input.online,
      started_at: ts,
      ended_at: ts,
    },
  };

  const telemetry: SyncEvent[] = input.choices.map((edgeId, i) => ({
    client_event_uuid: input.genUuid(),
    device_ts: ts,
    table: 'sim_telemetry_events',
    op: 'append',
    payload: {
      sim_attempt_id: attemptId,
      event_type: 'branch_choice',
      payload: { edge_id: edgeId, index: i },
    },
  }));

  return [attempt, ...telemetry];
}
