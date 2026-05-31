// M2 — turn a graded knowledge-check ATTEMPT into append-only assessment_responses
// SyncEvents for the F4 /sync path (mirrors forge/ac203Recording.buildAttemptEvents).
// This is the response LOG; it is NOT the mastery gate. The authoritative verdict +
// any competency_state promotion are server-only (invariant 2/3) via the
// grade-knowledge-check Edge Function — a client cannot fake a pass by writing these
// rows, because promotion is recomputed server-side from these durable responses.
//
// Idempotent by construction: each row carries its own client_event_uuid (injected
// by planWrite), so a double-flush (ON CONFLICT DO NOTHING) cannot double-count.
// The `attempt` index increments per retry; the server reads the LATEST attempt.
import type { SyncEvent } from '@redex/sync-core';

export interface CheckResponse {
  assessmentItemId: string;
  /** The learner's answer (shape per item kind: {choice}/{choices}/{value}/{order}/{region}). */
  response: unknown;
}

export interface BuildCheckEventsInput {
  userId: string;
  orgId: string;
  enrollmentId?: string | null;
  /** 1-based attempt number for this submission (increments on each retry). */
  attempt: number;
  responses: CheckResponse[];
  genUuid: () => string;
  now: () => string;
}

/**
 * Build the append-only SyncEvents for one knowledge-check submission: one
 * assessment_responses row per answered item. Pure + deterministic (inject
 * genUuid/now). The client never sets `score` — the server grades (graded_by
 * 'auto'); writing a client score would be a faked pass (invariant 5).
 */
export function buildCheckResponseEvents(input: BuildCheckEventsInput): SyncEvent[] {
  const ts = input.now();
  return input.responses.map((r) => ({
    client_event_uuid: input.genUuid(),
    device_ts: ts,
    table: 'assessment_responses',
    op: 'append',
    payload: {
      user_id: input.userId,
      org_id: input.orgId,
      assessment_item_id: r.assessmentItemId,
      enrollment_id: input.enrollmentId ?? null,
      response: r.response,
      attempt: input.attempt,
      graded_by: 'auto',
    },
  }));
}
