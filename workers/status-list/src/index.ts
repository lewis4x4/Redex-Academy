// ============================================================================
// workers/status-list — Cloudflare Worker (F6)
//
// Serves the hosted BitstringStatusList credential a verifier checks for
// revocation:
//   GET /status/:listId  → the signed BitstringStatusListCredential JSON
//
// When the issuer revokes a credential it flips that credential's bit, re-signs
// the list, and re-publishes it to the STATUS_LIST store; this Worker serves the
// current list with a SHORT cache so the revocation propagates quickly. Public +
// read-only (the bitstring carries no PII — credential_status_list is public by
// design, ledger §F). Deploy via wrangler (the §J release gate); see ../README.md.
// ============================================================================
import {
  statusListResponse,
  corsPreflightResponse,
  notFoundResponse,
  methodNotAllowedResponse,
} from '@redex/credentials';

export interface StatusListStore {
  get(key: string): Promise<string | null>;
}

export interface Env {
  /** KV store of published, signed status-list credentials, keyed by list id. */
  STATUS_LIST: StatusListStore;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflightResponse();
    if (request.method !== 'GET') return methodNotAllowedResponse();

    const { pathname } = new URL(request.url);
    const match = /^\/status\/([A-Za-z0-9._-]+)$/.exec(pathname);
    if (!match) return notFoundResponse();

    const stored = await env.STATUS_LIST.get(match[1]);
    if (stored === null) return notFoundResponse('status_list_not_found');
    return statusListResponse(JSON.parse(stored));
  },
};
