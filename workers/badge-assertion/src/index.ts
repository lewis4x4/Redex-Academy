// ============================================================================
// workers/badge-assertion — Cloudflare Worker (F6)
//
// Serves the PUBLIC, always-on, verifiable credential assertion:
//   GET /credentials/:id  → the signed OB 3.0 credential JSON
//
// The issue-badge Edge Function publishes each signed credential to the
// ASSERTIONS store keyed by its id; this Worker serves it so the badge "verifies
// at a public URL". Read-only + public (the credential carries no secret).
// Deploy via wrangler (the §J release gate); see ../README.md.
// ============================================================================
import {
  assertionResponse,
  corsPreflightResponse,
  notFoundResponse,
  methodNotAllowedResponse,
} from '@redex/credentials';

export interface AssertionStore {
  get(key: string): Promise<string | null>;
}

export interface Env {
  /** KV (or R2-backed) store of published assertions, keyed by credential id. */
  ASSERTIONS: AssertionStore;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflightResponse();
    if (request.method !== 'GET') return methodNotAllowedResponse();

    const { pathname } = new URL(request.url);
    const match = /^\/credentials\/([A-Za-z0-9._-]+)$/.exec(pathname);
    if (!match) return notFoundResponse();

    const stored = await env.ASSERTIONS.get(match[1]);
    if (stored === null) return notFoundResponse('credential_not_found');
    return assertionResponse(JSON.parse(stored));
  },
};
