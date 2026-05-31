// ============================================================================
// packages/credentials/src/issuer-config.ts
//
// THE single source of truth for the issuer identity (ledger §F / invariant 7).
//
// ─────────────────────────────────────────────────────────────────────────
// ISSUER-DID RECONCILIATION (surfaced, operator-authorized bend) — READ THIS.
// The pinned invariant text historically named `did:web:academy.goredex.com`,
// a PLACEHOLDER from before the domain was settled. The product is hosted at
// `redex.education` (see supabase/config.toml auth callbacks + .env.example),
// so a `goredex.com` did:web would NOT resolve and a badge would FAIL to verify
// at a public URL — the headline §J gate. The issuer is now re-hosted at the
// APEX `did:web:redex.education` (the never-deployable subdomain Cloudflare
// stack is dropped); this constant is the single value every artifact derives
// from. See adr/ADR-0005 (addendum) + CLAUDE.md.
// ─────────────────────────────────────────────────────────────────────────
//
// `did:web:redex.education` resolves to
//   https://redex.education/.well-known/did.json   (the DID document)
// and the OB 3.0 issuer Profile + the BitstringStatusList live under the same
// apex origin, served by Netlify static files (the `.well-known` DID document +
// issuer Profile under apps/web/public/.well-known/) plus two public Supabase
// Edge Functions (hosted-assertion + status-list), proxied from /credentials/*
// and /status/* by netlify.toml.
// ============================================================================

/** The reconciled issuer DID (see the banner above). */
export const DEFAULT_ISSUER_DID = 'did:web:redex.education';

/** Pinned Data Integrity proof suite (ledger §F / invariant 7). */
export const PROOF_SUITE = 'eddsa-rdfc-2022' as const;

/** The credential `@context` array (order matters for canonicalization). */
export const CREDENTIAL_CONTEXT = [
  'https://www.w3.org/ns/credentials/v2',
  'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
] as const;

export interface IssuerEndpoints {
  /** Issuer DID, e.g. `did:web:redex.education`. */
  did: string;
  /** Origin the did:web resolves to, e.g. `https://redex.education`. */
  origin: string;
  /** DID document URL (`.well-known/did.json`). */
  didDocumentUrl: string;
  /** OB 3.0 issuer Profile URL. */
  profileUrl: string;
  /** Base URL for hosted, verifiable credential assertions. */
  assertionBaseUrl: string;
  /** The hosted BitstringStatusList credential URL. */
  statusListUrl: string;
}

/**
 * Convert a `did:web` identifier to its HTTPS origin + standard endpoints.
 * Follows the did:web method: the method-specific id is percent-decoded and
 * `:` path separators become `/`; with no path, the document lives at
 * `/.well-known/did.json`.
 */
export function resolveIssuerEndpoints(did: string = DEFAULT_ISSUER_DID): IssuerEndpoints {
  if (!did.startsWith('did:web:')) {
    throw new Error(`only did:web is supported for the issuer, got: ${did}`);
  }
  const idPart = did.slice('did:web:'.length);
  const segments = idPart.split(':').map(decodeURIComponent);
  const host = segments[0]!;
  const path = segments.slice(1).join('/');
  const origin = `https://${host}`;
  const didDocumentUrl = path ? `${origin}/${path}/did.json` : `${origin}/.well-known/did.json`;
  const base = path ? `${origin}/${path}` : origin;
  return {
    did,
    origin,
    didDocumentUrl,
    profileUrl: `${base}/.well-known/issuer`,
    assertionBaseUrl: `${base}/credentials`,
    statusListUrl: `${base}/status/1`,
  };
}
