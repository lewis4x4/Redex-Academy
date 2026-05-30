import type { SyncableTable } from '@redex/sync-core';
import Dexie, { type Table } from 'dexie';

/** A locally-generated fact queued offline. The PRIMARY KEY is client_event_uuid
 *  — so re-enqueuing the same fact is idempotent locally, and it is the dedupe
 *  key the server uses (ON CONFLICT DO NOTHING). Every row carries a device_ts. */
export interface QueuedEvent {
  client_event_uuid: string;
  device_ts: string;
  table: SyncableTable;
  op: 'append' | 'upsert';
  payload: Record<string, unknown>;
  status: 'queued' | 'synced' | 'rejected';
  reason?: string;
  created_at: number;
}

/** A downloaded course "field pack" — sim JSON specs, checklists, captions, the
 *  sign-off rubric. VIDEO IS NOT STORED HERE (explicit per-video opt-in only). */
export interface CoursePack {
  course_code: string;
  version: string;
  assets: Record<string, unknown>;
  downloaded_at: number;
}

/** Evidence photo Blob for a queued sign-off DRAFT (keyed to its event uuid). */
export interface EvidenceBlob {
  client_event_uuid: string;
  blob: Blob;
  created_at: number;
}

/** A queued xAPI statement. F4 only DURABLY QUEUES xAPI offline — the LRS/bridge
 *  forwarding is M8 (out of scope here). The statement id is the client-generated
 *  idempotency key (xAPI statements are idempotent by id), with a device_ts. */
export interface QueuedXapiStatement {
  id: string;
  statement: Record<string, unknown>;
  device_ts: string;
  status: 'queued' | 'forwarded';
  created_at: number;
}

export class AcademyOfflineDB extends Dexie {
  events!: Table<QueuedEvent, string>;
  packs!: Table<CoursePack, string>;
  evidence!: Table<EvidenceBlob, string>;
  xapi!: Table<QueuedXapiStatement, string>;

  constructor(name = 'redex-academy-offline') {
    super(name);
    this.version(1).stores({
      events: 'client_event_uuid, status, table, created_at',
      packs: 'course_code',
      evidence: 'client_event_uuid',
      xapi: 'id, status, created_at', // F4 queues xAPI; M8 forwards to the LRS
    });
  }
}

export const db = new AcademyOfflineDB();
