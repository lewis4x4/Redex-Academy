// ============================================================================
// workers/issuer-wellknown — Cloudflare Worker (F6)
//
// Serves the issuer's PUBLIC identity so a verifier can resolve a did:web badge:
//   GET /.well-known/did.json   → the DID document (current + retired keys)
//   GET /.well-known/issuer     → the OB 3.0 issuer Profile
//
// Thin entrypoint: all shaping lives in @redex/credentials (tested in CI). Only
// PUBLIC keys are served — the Ed25519 PRIVATE key lives in Supabase Vault with
// the issue-badge Edge Function and never touches Cloudflare (invariant 7/8).
// Deploy via wrangler (the §J release gate); see ../README.md.
// ============================================================================
import {
  buildDidDocument,
  buildIssuerProfile,
  didDocumentResponse,
  issuerProfileResponse,
  corsPreflightResponse,
  notFoundResponse,
  methodNotAllowedResponse,
  type IssuerKey,
} from '@redex/credentials';

export interface Env {
  /** Issuer DID, e.g. `did:web:academy.redex.education`. */
  OB_ISSUER_DID: string;
  /** JSON array of PUBLIC keys: [{id, publicKeyMultibase, status, retiredAt?}]. */
  ISSUER_KEYS: string;
  /** Display name for the issuer Profile. */
  OB_ISSUER_NAME?: string;
}

function loadKeys(env: Env): IssuerKey[] {
  return JSON.parse(env.ISSUER_KEYS) as IssuerKey[];
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflightResponse();
    if (request.method !== 'GET') return methodNotAllowedResponse();

    const { pathname } = new URL(request.url);
    const keys = loadKeys(env);

    if (pathname === '/.well-known/did.json') {
      return didDocumentResponse(buildDidDocument(keys, env.OB_ISSUER_DID));
    }
    if (pathname === '/.well-known/issuer') {
      return issuerProfileResponse(
        buildIssuerProfile({
          did: env.OB_ISSUER_DID,
          name: env.OB_ISSUER_NAME ?? 'Redex Academy',
          keys,
        }),
      );
    }
    return notFoundResponse();
  },
};
