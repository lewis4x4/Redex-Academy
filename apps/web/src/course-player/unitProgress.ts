// Phase 2 (course-player) — per-unit progress, recorded through the F4 offline
// sync-queue (NO new schema; academy.unit_progress already exists + is a registered
// SYNCABLE UPSERT table in @redex/sync-core, CONFLICT_TARGET 'enrollment_id,unit_id').
//
// INVARIANTS honored here:
//   * The client records ONLY unit_progress (educational completion); it NEVER writes
//     competency_state — that promotion is server-only (Inv. 3). competency_state has
//     no client write policy, and validateSyncEvent would reject a server-only field
//     anyway (Inv. 5, defense in depth).
//   * The upsert payload MUST carry both conflict keys (enrollment_id + unit_id) or
//     validateSyncEvent rejects with missing_conflict_key — the idempotency key for a
//     re-flush (LWW). enqueue() refuses any illegal event, so a refused write surfaces
//     (it never silently looks "done").
//   * Lesson / signoff_prep completion = client-recorded 'passed' (educational, not a
//     server gate). Sim / scenario / knowledge_check = the CALLER records 'passed' ONLY
//     after the server function returned a pass (the renderers gate this; offline never
//     fakes a pass — Inv. 5).

import type { SyncEvent } from '@redex/sync-core';
import { supabase } from '../auth/supabaseClient';
import { enqueue } from '../offline/sync-queue';

export type UnitProgressStatus = 'locked' | 'available' | 'in_progress' | 'passed' | 'failed';

export interface RecordUnitProgressInput {
  enrollmentId: string;
  unitId: string;
  orgId: string;
  status: UnitProgressStatus;
  /** 0..1 mastery score (sim Verdict / KC threshold); omitted for lesson/signoff_prep. */
  score?: number;
  /** Attempt count for this unit (>= 0). Defaults to 1 when recording a completion. */
  attempts?: number;
  /** Injected for tests/determinism. Defaults to crypto.randomUUID + Date.now ISO. */
  genUuid?: () => string;
  now?: () => string;
}

/**
 * Build the upsert SyncEvent for a unit_progress tick and enqueue it (offline-tolerant;
 * flushes on reconnect). Both conflict keys (enrollment_id, unit_id) are in the payload
 * so a double-flush is idempotent (LWW on the natural key). Never writes a server-only
 * field. Returns the queued event (useful for tests/telemetry).
 */
export async function recordUnitProgress(input: RecordUnitProgressInput): Promise<SyncEvent> {
  const uuid = input.genUuid ?? (() => globalThis.crypto.randomUUID());
  const stamp = input.now ?? (() => new Date().toISOString());
  const event: SyncEvent = {
    client_event_uuid: uuid(),
    device_ts: stamp(),
    table: 'unit_progress',
    op: 'upsert',
    payload: {
      enrollment_id: input.enrollmentId, // CONFLICT_TARGET key #1 (required)
      unit_id: input.unitId, // CONFLICT_TARGET key #2 (required)
      org_id: input.orgId,
      status: input.status,
      attempts: input.attempts ?? 1,
      ...(input.score !== undefined ? { score: input.score } : {}),
      last_attempt_at: stamp(),
    },
  };
  await enqueue(event); // enqueue validates (refuses any server-only field / missing key)
  return event;
}

/** A learner's progress for one unit (the local mirror used to resume + render dots). */
export interface UnitProgressRow {
  status: UnitProgressStatus;
  score: number | null;
  attempts: number;
}

const academy = () => supabase.schema('academy');

/**
 * Read the learner's OWN unit_progress rows for an enrollment (RLS
 * unit_progress_select_own scopes to enrollment ownership). Returns a Map keyed by
 * unit_id so the player can resume at the first non-'passed' unit and render the rail.
 * A cross-org learner gets ZERO rows (proven in supabase/tests/0002_rls_negative.sql).
 * Throws on a transport error.
 */
export async function loadUnitProgress(
  enrollmentId: string,
): Promise<Map<string, UnitProgressRow>> {
  const { data, error } = await academy()
    .from('unit_progress')
    .select('unit_id, status, score, attempts')
    .eq('enrollment_id', enrollmentId);
  if (error) throw new Error(`unit_progress read failed: ${error.message}`);
  const map = new Map<string, UnitProgressRow>();
  for (const r of (data ?? []) as Array<{
    unit_id: string;
    status: UnitProgressStatus;
    score: number | null;
    attempts: number | null;
  }>) {
    map.set(r.unit_id, { status: r.status, score: r.score, attempts: r.attempts ?? 0 });
  }
  return map;
}
