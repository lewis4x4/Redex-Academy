import { describe, expect, it } from 'vitest';
import {
  lwwResolveDraft,
  planWrite,
  syncEventSchema,
  validateSyncBatch,
  validateSyncEvent,
  type SyncEvent,
} from './index';

const base = {
  client_event_uuid: '00000000-0000-0000-0000-0000000000a1',
  device_ts: '2026-05-29T12:00:00.000Z',
};
const ev = (over: Partial<SyncEvent>): SyncEvent =>
  syncEventSchema.parse({ ...base, table: 'sim_attempts', op: 'append', payload: {}, ...over });

describe('sync-core: append-only idempotency contract', () => {
  it('accepts an append event and classifies it append_only', () => {
    const v = validateSyncEvent(
      ev({ table: 'sim_telemetry_events', op: 'append', payload: { event_type: 'tap' } }),
    );
    expect(v).toEqual({ ok: true, classification: 'append_only' });
  });
  it('requires every event to carry a client_event_uuid (idempotency/queue key)', () => {
    expect(
      syncEventSchema.safeParse({
        ...base,
        client_event_uuid: undefined,
        table: 'sim_attempts',
        op: 'append',
        payload: {},
      }).success,
    ).toBe(false);
  });
  it('rejects an append table sent with the wrong op', () => {
    expect(validateSyncEvent(ev({ table: 'sim_attempts', op: 'upsert' })).reason).toBe(
      'append_op_mismatch',
    );
  });
});

const UID = '00000000-0000-0000-0000-0000000000d4';

describe('sync-core: upsert classification (drafts + progress ticks)', () => {
  it('classifies unit_progress as upsert (NOT unknown_table — the bug fix)', () => {
    expect(
      validateSyncEvent(
        ev({
          table: 'unit_progress',
          op: 'upsert',
          payload: { status: 'in_progress', enrollment_id: UID, unit_id: UID },
        }),
      ),
    ).toEqual({
      ok: true,
      classification: 'upsert',
    });
  });
  it('classifies a draft sign-off as upsert', () => {
    expect(
      validateSyncEvent(
        ev({ table: 'signoffs', op: 'upsert', payload: { id: UID, status: 'draft' } }),
      ).classification,
    ).toBe('upsert');
    expect(
      validateSyncEvent(
        ev({
          table: 'signoff_line_items',
          op: 'upsert',
          payload: { signoff_id: UID, line_item_key: 'k1' },
        }),
      ).classification,
    ).toBe('upsert');
  });
  it('rejects an upsert table sent with the wrong op', () => {
    expect(validateSyncEvent(ev({ table: 'unit_progress', op: 'append' })).reason).toBe(
      'upsert_op_mismatch',
    );
  });
  it('rejects an id-keyed upsert with NO stable id — would duplicate on double-flush (inv. 5)', () => {
    expect(
      validateSyncEvent(ev({ table: 'signoffs', op: 'upsert', payload: { status: 'draft' } }))
        .reason,
    ).toBe('missing_conflict_key');
    expect(
      validateSyncEvent(ev({ table: 'signoff_evidence', op: 'upsert', payload: {} })).reason,
    ).toBe('missing_conflict_key');
  });
  it('rejects an upsert missing part of a composite natural key', () => {
    expect(
      validateSyncEvent(
        ev({ table: 'unit_progress', op: 'upsert', payload: { enrollment_id: UID } }),
      ).reason,
    ).toBe('missing_conflict_key');
  });
});

describe('sync-core: planWrite — append carries client_event_uuid, upsert uses the natural key', () => {
  it('append → row has client_event_uuid, onConflict=client_event_uuid, DO NOTHING', () => {
    const p = planWrite(
      ev({ table: 'sim_attempts', op: 'append', payload: { score: 3 } }),
      'append_only',
    );
    expect(p.row['client_event_uuid']).toBe(base.client_event_uuid);
    expect(p.onConflict).toBe('client_event_uuid');
    expect(p.ignoreDuplicates).toBe(true);
  });
  it('draft sign-off → row OMITS client_event_uuid, onConflict=id (the table lacks that column)', () => {
    const p = planWrite(
      ev({ table: 'signoffs', op: 'upsert', payload: { id: 'x', status: 'draft' } }),
      'upsert',
    );
    expect('client_event_uuid' in p.row).toBe(false);
    expect(p.onConflict).toBe('id');
    expect(p.ignoreDuplicates).toBe(false);
  });
  it('signoff_line_items → onConflict=signoff_id,line_item_key; unit_progress → enrollment_id,unit_id', () => {
    expect(planWrite(ev({ table: 'signoff_line_items', op: 'upsert' }), 'upsert').onConflict).toBe(
      'signoff_id,line_item_key',
    );
    expect(planWrite(ev({ table: 'unit_progress', op: 'upsert' }), 'upsert').onConflict).toBe(
      'enrollment_id,unit_id',
    );
    expect(
      'client_event_uuid' in planWrite(ev({ table: 'unit_progress', op: 'upsert' }), 'upsert').row,
    ).toBe(false);
  });
});

describe('sync-core: never fake a pass (server-only rejection)', () => {
  it('rejects a client-set sign-off outcome', () => {
    expect(
      validateSyncEvent(ev({ table: 'signoffs', op: 'upsert', payload: { outcome: 'pass' } }))
        .reason,
    ).toBe('server_only_field');
  });
  it('rejects client-set sign-off finalize fields (signed_at / superseded_by / void_reason)', () => {
    for (const f of ['signed_at', 'superseded_by', 'void_reason']) {
      expect(
        validateSyncEvent(ev({ table: 'signoffs', op: 'upsert', payload: { id: UID, [f]: 'x' } }))
          .reason,
      ).toBe('server_only_field');
    }
  });
  it('ALLOWS sim_attempts.outcome — the engine’s client-side attempt result reconciles offline (§G)', () => {
    // Ledger §G: sim ATTEMPT outcome is append-only telemetry (the "Do" rehearsal),
    // NOT the server-only sign-off/mastery verdict. Blocking it would break the #1
    // acceptance flow ("complete a sim offline → reconcile attempts").
    const v = validateSyncEvent(
      ev({ table: 'sim_attempts', op: 'append', payload: { outcome: 'pass', score: 3 } }),
    );
    expect(v).toEqual({ ok: true, classification: 'append_only' });
  });
  it('rejects competency_state / credentials / recert / badge tables entirely', () => {
    for (const t of [
      'competency_state',
      'credentials',
      'recert_schedules',
      'badge_classes',
      'audit_log',
    ]) {
      expect(
        syncEventSchema.safeParse({ ...base, table: t, op: 'append', payload: {} }).success,
      ).toBe(false);
    }
  });
});

describe('sync-core: signed sign-off immutability (draft path only)', () => {
  it('accepts draft/submitted', () => {
    expect(
      validateSyncEvent(
        ev({ table: 'signoffs', op: 'upsert', payload: { id: UID, status: 'submitted' } }),
      ).ok,
    ).toBe(true);
  });
  it('rejects a client trying to SIGN via /sync', () => {
    expect(
      validateSyncEvent(
        ev({ table: 'signoffs', op: 'upsert', payload: { id: UID, status: 'signed' } }),
      ).reason,
    ).toBe('signed_signoff_edit');
  });
});

describe('sync-core: batch + LWW', () => {
  it('separates accepted from rejected without dropping work', () => {
    const r = validateSyncBatch({
      events: [
        ev({
          table: 'sim_attempts',
          op: 'append',
          client_event_uuid: '00000000-0000-0000-0000-0000000000b2',
        }),
        ev({
          table: 'signoffs',
          op: 'upsert',
          payload: { outcome: 'pass' },
          client_event_uuid: '00000000-0000-0000-0000-0000000000c3',
        }),
      ],
    });
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected[0]?.reason).toBe('server_only_field');
  });
  it('LWW: local-only/server-only/two-sided', () => {
    expect(
      lwwResolveDraft({
        localChangedSinceSync: true,
        serverChangedSinceSync: false,
        localServerReceiptMs: 0,
        serverUpdatedMs: 0,
      }),
    ).toBe('local');
    expect(
      lwwResolveDraft({
        localChangedSinceSync: false,
        serverChangedSinceSync: true,
        localServerReceiptMs: 0,
        serverUpdatedMs: 0,
      }),
    ).toBe('server');
    expect(
      lwwResolveDraft({
        localChangedSinceSync: true,
        serverChangedSinceSync: true,
        localServerReceiptMs: 9,
        serverUpdatedMs: 1,
      }),
    ).toBe('conflict');
  });
});
