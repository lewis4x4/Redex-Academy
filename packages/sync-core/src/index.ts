import { z } from 'zod';

/**
 * @redex/sync-core — the offline `/sync` CONTRACT (F4), shared by the client
 * queue and mirrored by the Deno `/sync` Edge Function. Pure + runtime-agnostic
 * (Zod only) so it is unit-tested here and importable from the browser. Enforces
 * ledger §G + CLAUDE.md invariants 2/4:
 *   - APPEND-ONLY events are idempotent on client_event_uuid (DB ON CONFLICT DO
 *     NOTHING) — a double-flush cannot double-count;
 *   - UPSERT rows (progress ticks + draft sign-offs) are LWW by server receipt,
 *     keyed on their F2 NATURAL key (those tables have NO client_event_uuid column);
 *   - the client may NEVER set a server-only/state field (no faked pass);
 *   - a signed sign-off is immutable (drafts may only carry draft/submitted status).
 */

export const SYNCABLE_TABLES = [
  'sim_attempts',
  'sim_telemetry_events',
  'assessment_responses',
  'unit_progress',
  'signoffs',
  'signoff_line_items',
  'signoff_evidence',
] as const;
export type SyncableTable = (typeof SYNCABLE_TABLES)[number];

/** Append-only event tables — these F2 tables carry UNIQUE(client_event_uuid);
 *  idempotent insert ON CONFLICT (client_event_uuid) DO NOTHING; never LWW. */
export const APPEND_ONLY_TABLES = [
  'sim_attempts',
  'sim_telemetry_events',
  'assessment_responses',
] as const;

/** Upsert tables — LWW by server receipt, keyed on their F2 NATURAL key. These
 *  tables do NOT have a client_event_uuid column (do not write one). Covers
 *  progress ticks (unit_progress) and the DRAFT sign-off path. */
export const UPSERT_TABLES = [
  'unit_progress',
  'signoffs',
  'signoff_line_items',
  'signoff_evidence',
] as const;

/** Of the upsert tables, the draft sign-off tables — guarded to draft/submitted. */
export const SIGNOFF_DRAFT_TABLES = ['signoffs', 'signoff_line_items', 'signoff_evidence'] as const;

/** The DB ON CONFLICT target per table — what /sync upserts on. Append tables
 *  dedupe on the client UUID; upsert tables use their real F2 unique/PK key.
 *  For the id-keyed tables (signoffs, signoff_evidence) the conflict key is the
 *  PRIMARY KEY `id`, which defaults to gen_random_uuid() — so a stable, client-
 *  supplied `id` is MANDATORY (validateSyncEvent enforces it). Without it each
 *  re-flush would insert a fresh random id and ON CONFLICT (id) would never fire,
 *  duplicating draft rows on a double-flush (inv. 5). */
export const CONFLICT_TARGET: Record<SyncableTable, string> = {
  sim_attempts: 'client_event_uuid',
  sim_telemetry_events: 'client_event_uuid',
  assessment_responses: 'client_event_uuid',
  unit_progress: 'enrollment_id,unit_id',
  signoffs: 'id',
  signoff_line_items: 'signoff_id,line_item_key',
  signoff_evidence: 'id',
};

/** The payload columns that MUST be present (stable, non-empty) on an UPSERT
 *  event so the ON CONFLICT target is deterministic across re-flushes. Derived
 *  from CONFLICT_TARGET. Append tables are excluded — they dedupe on the event's
 *  client_event_uuid, which planWrite injects (it is never in the payload). */
export function conflictKeyColumns(table: SyncableTable): string[] {
  return CONFLICT_TARGET[table].split(',').map((c) => c.trim());
}

/**
 * Fields the client may NEVER set on ANY syncable table — credential/badge proof
 * fields that confer server authority (defense in depth; none of the syncable
 * tables even have these columns, but a future one must not either). Promotion /
 * mastery / credentials live in NON-syncable tables (blocked wholesale).
 */
export const SERVER_ONLY_FIELDS = [
  'status_list_index',
  'open_badge_json',
  'proof',
  'hosted_assertion_url',
  'revoked',
] as const;

/**
 * Sign-off FINALIZE fields — server-only ON THE SIGN-OFF TABLES only (ledger §G:
 * "sign-off finalize/outcome" is server-authoritative; M6 computes it). A client
 * may draft a sign-off offline but may NEVER set its outcome/signed_at — that
 * would fake a pass. NOTE: `outcome` is intentionally NOT global — `sim_attempts.
 * outcome` is the sim engine's CLIENT-side attempt result (the "Do" rehearsal),
 * which is append-only telemetry that legitimately reconciles offline (§G line 47).
 */
export const SIGNOFF_FINALIZE_FIELDS = [
  'outcome',
  'signed_at',
  'superseded_by',
  'void_reason',
] as const;

export const DRAFT_SIGNOFF_STATUSES = ['draft', 'submitted'] as const;

export const syncEventSchema = z.object({
  // The local queue key; ALSO the idempotency key for append-only tables. For
  // upsert tables it is the queue key only (never written to the DB row).
  client_event_uuid: z.string().uuid(),
  device_ts: z.string().min(1),
  table: z.enum(SYNCABLE_TABLES),
  op: z.enum(['append', 'upsert']),
  payload: z.record(z.string(), z.unknown()),
});
export type SyncEvent = z.infer<typeof syncEventSchema>;

export const syncBatchSchema = z.object({ events: z.array(syncEventSchema).max(500) });
export type SyncBatch = z.infer<typeof syncBatchSchema>;

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
  detail?: string;
}

export function validateSyncEvent(event: SyncEvent): EventVerdict {
  for (const key of Object.keys(event.payload)) {
    if ((SERVER_ONLY_FIELDS as readonly string[]).includes(key)) {
      return { ok: false, reason: 'server_only_field', detail: `client may not set "${key}"` };
    }
  }

  if ((APPEND_ONLY_TABLES as readonly string[]).includes(event.table)) {
    if (event.op !== 'append') return { ok: false, reason: 'append_op_mismatch' };
    return { ok: true, classification: 'append_only' };
  }

  if ((UPSERT_TABLES as readonly string[]).includes(event.table)) {
    if (event.op !== 'upsert') return { ok: false, reason: 'upsert_op_mismatch' };
    if ((SIGNOFF_DRAFT_TABLES as readonly string[]).includes(event.table)) {
      // Faked-pass guard FIRST (security before idempotency): the client may draft
      // a sign-off but never set a finalize field, and never SIGN it via /sync.
      for (const key of Object.keys(event.payload)) {
        if ((SIGNOFF_FINALIZE_FIELDS as readonly string[]).includes(key)) {
          return {
            ok: false,
            reason: 'server_only_field',
            detail: `sign-off "${key}" is server-only (finalize is M6) — never fake a pass`,
          };
        }
      }
      const status = event.payload['status'];
      if (
        status !== undefined &&
        !(DRAFT_SIGNOFF_STATUSES as readonly string[]).includes(status as string)
      ) {
        return {
          ok: false,
          reason: 'signed_signoff_edit',
          detail: `draft status must be draft|submitted, got "${String(status)}"`,
        };
      }
    }
    // The ON CONFLICT key must be deterministic across re-flushes or a double-
    // flush duplicates (inv. 5). For id-keyed draft tables this forces a stable,
    // client-supplied `id` (the DB default is gen_random_uuid()).
    for (const col of conflictKeyColumns(event.table)) {
      const v = event.payload[col];
      if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
        return {
          ok: false,
          reason: 'missing_conflict_key',
          detail: `upsert to ${event.table} requires a stable "${col}" in payload (idempotency key)`,
        };
      }
    }
    return { ok: true, classification: 'upsert' };
  }

  return { ok: false, reason: 'unknown_table' };
}

export interface WritePlan {
  table: SyncableTable;
  row: Record<string, unknown>;
  onConflict: string;
  ignoreDuplicates: boolean;
}

/**
 * Compute the DB write for a validated event. THE fix for the draft-table bug:
 * only append-only rows carry client_event_uuid (their tables have that column +
 * UNIQUE); upsert rows are written WITHOUT it and reconcile on the natural key.
 */
export function planWrite(event: SyncEvent, classification: EventClassification): WritePlan {
  if (classification === 'append_only') {
    return {
      table: event.table,
      row: { ...event.payload, client_event_uuid: event.client_event_uuid },
      onConflict: 'client_event_uuid',
      ignoreDuplicates: true, // ON CONFLICT DO NOTHING → no double-count
    };
  }
  return {
    table: event.table,
    row: { ...event.payload }, // NO client_event_uuid — the upsert tables lack that column
    onConflict: CONFLICT_TARGET[event.table],
    ignoreDuplicates: false, // ON CONFLICT DO UPDATE (LWW by server receipt)
  };
}

export interface BatchVerdict {
  accepted: { event: SyncEvent; classification: EventClassification }[];
  rejected: { event: SyncEvent; reason: RejectReason; detail?: string }[];
}

export function validateSyncBatch(input: unknown): BatchVerdict {
  const batch = syncBatchSchema.parse(input);
  const accepted: BatchVerdict['accepted'] = [];
  const rejected: BatchVerdict['rejected'] = [];
  for (const event of batch.events) {
    const v = validateSyncEvent(event);
    if (v.ok && v.classification) accepted.push({ event, classification: v.classification });
    else rejected.push({ event, reason: v.reason ?? 'invalid', detail: v.detail });
  }
  return { accepted, rejected };
}

export type LwwDecision = 'local' | 'server' | 'conflict';

/** LWW for UPSERT rows ONLY (drafts/ticks) — never append-only events. Winner =
 *  most recent by SERVER RECEIPT; both-changed → conflict (surface, never drop). */
export function lwwResolveDraft(args: {
  localChangedSinceSync: boolean;
  serverChangedSinceSync: boolean;
  localServerReceiptMs: number;
  serverUpdatedMs: number;
  skewMs?: number;
}): LwwDecision {
  const skew = args.skewMs ?? 2000;
  if (args.localChangedSinceSync && args.serverChangedSinceSync) return 'conflict';
  if (!args.localChangedSinceSync) return 'server';
  if (!args.serverChangedSinceSync) return 'local';
  return args.localServerReceiptMs >= args.serverUpdatedMs - skew ? 'local' : 'server';
}
