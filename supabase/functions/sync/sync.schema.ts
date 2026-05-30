// ============================================================================
// supabase/functions/sync/sync.schema.ts  (Deno)
// MIRRORS the tested contract in @redex/sync-core (packages/sync-core/src/index.ts).
// Keep the two in lockstep — the rules here are exercised by sync-core's unit
// tests + supabase/tests/sync_idempotency_test.sql + the [HUMAN-VERIFY] live run.
// Deno Edge Functions are Deno: zod resolves via the deno.json import map to
// npm:zod (see supabase/functions/deno.json) — NEVER a Node-only module.
// ============================================================================
import { z } from 'zod';

export const SYNCABLE_TABLES = [
  'sim_attempts',
  'sim_telemetry_events',
  'assessment_responses',
  'unit_progress',
  'signoffs',
  'signoff_line_items',
  'signoff_evidence',
] as const;

// Append-only: carry UNIQUE(client_event_uuid); idempotent ON CONFLICT DO NOTHING.
export const APPEND_ONLY_TABLES = ['sim_attempts', 'sim_telemetry_events', 'assessment_responses'];
// Upsert (LWW by natural key; NO client_event_uuid column): ticks + draft sign-offs.
export const UPSERT_TABLES = ['unit_progress', 'signoffs', 'signoff_line_items', 'signoff_evidence'];
export const SIGNOFF_DRAFT_TABLES = ['signoffs', 'signoff_line_items', 'signoff_evidence'];

export const CONFLICT_TARGET: Record<string, string> = {
  sim_attempts: 'client_event_uuid',
  sim_telemetry_events: 'client_event_uuid',
  assessment_responses: 'client_event_uuid',
  unit_progress: 'enrollment_id,unit_id',
  signoffs: 'id',
  signoff_line_items: 'signoff_id,line_item_key',
  signoff_evidence: 'id',
};

// Upsert payloads MUST carry these columns (stable, non-empty) so ON CONFLICT is
// deterministic across re-flushes (inv. 5). id-keyed tables => a client-supplied id.
export function conflictKeyColumns(table: string): string[] {
  return CONFLICT_TARGET[table].split(',').map((c) => c.trim());
}

// Global (any syncable table) — credential/badge proof fields, defense in depth.
export const SERVER_ONLY_FIELDS = [
  'status_list_index',
  'open_badge_json',
  'proof',
  'hosted_assertion_url',
  'revoked',
];
// Sign-off FINALIZE fields — server-only on the sign-off tables ONLY (ledger §G).
// `outcome` is NOT global: sim_attempts.outcome is the client-side attempt result.
export const SIGNOFF_FINALIZE_FIELDS = ['outcome', 'signed_at', 'superseded_by', 'void_reason'];
export const DRAFT_SIGNOFF_STATUSES = ['draft', 'submitted'];

export const syncEventSchema = z.object({
  client_event_uuid: z.string().uuid(),
  device_ts: z.string().min(1),
  table: z.enum(SYNCABLE_TABLES),
  op: z.enum(['append', 'upsert']),
  payload: z.record(z.string(), z.unknown()),
});
export type SyncEvent = z.infer<typeof syncEventSchema>;
export const syncBatchSchema = z.object({ events: z.array(syncEventSchema).max(500) });

export type EventClassification = 'append_only' | 'upsert';
export type RejectReason =
  | 'unknown_table'
  | 'server_only_field'
  | 'signed_signoff_edit'
  | 'append_op_mismatch'
  | 'upsert_op_mismatch'
  | 'missing_conflict_key'
  | 'invalid';

export interface EventVerdict {
  ok: boolean;
  classification?: EventClassification;
  reason?: RejectReason;
}

export function validateSyncEvent(event: SyncEvent): EventVerdict {
  for (const key of Object.keys(event.payload)) {
    if (SERVER_ONLY_FIELDS.includes(key)) return { ok: false, reason: 'server_only_field' };
  }
  if (APPEND_ONLY_TABLES.includes(event.table)) {
    if (event.op !== 'append') return { ok: false, reason: 'append_op_mismatch' };
    return { ok: true, classification: 'append_only' };
  }
  if (UPSERT_TABLES.includes(event.table)) {
    if (event.op !== 'upsert') return { ok: false, reason: 'upsert_op_mismatch' };
    if (SIGNOFF_DRAFT_TABLES.includes(event.table)) {
      for (const key of Object.keys(event.payload)) {
        if (SIGNOFF_FINALIZE_FIELDS.includes(key)) return { ok: false, reason: 'server_only_field' };
      }
      const status = event.payload['status'];
      if (status !== undefined && !DRAFT_SIGNOFF_STATUSES.includes(status as string)) {
        return { ok: false, reason: 'signed_signoff_edit' };
      }
    }
    for (const col of conflictKeyColumns(event.table)) {
      const v = event.payload[col];
      if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
        return { ok: false, reason: 'missing_conflict_key' };
      }
    }
    return { ok: true, classification: 'upsert' };
  }
  return { ok: false, reason: 'unknown_table' };
}

export interface WritePlan {
  table: string;
  row: Record<string, unknown>;
  onConflict: string;
  ignoreDuplicates: boolean;
}

// Append-only rows carry client_event_uuid (their tables have it + UNIQUE);
// upsert rows do NOT (those tables have no such column) — reconcile on the natural key.
export function planWrite(event: SyncEvent, classification: EventClassification): WritePlan {
  if (classification === 'append_only') {
    return {
      table: event.table,
      row: { ...event.payload, client_event_uuid: event.client_event_uuid },
      onConflict: 'client_event_uuid',
      ignoreDuplicates: true,
    };
  }
  return {
    table: event.table,
    row: { ...event.payload },
    onConflict: CONFLICT_TARGET[event.table],
    ignoreDuplicates: false,
  };
}
