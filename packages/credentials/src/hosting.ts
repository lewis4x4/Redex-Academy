// ============================================================================
// packages/credentials/src/hosting.ts
//
// Public-serving response builders for the issuer's Cloudflare Workers (the
// `.well-known`/DID profile, the hosted credential assertion, and the
// BitstringStatusList endpoint). The Workers in `workers/` are thin entrypoints
// that fetch stored data and delegate here — so the public contract (media
// types, caching, CORS for browser-based verifiers) is tested in CI (vitest)
// even though the Workers themselves deploy via wrangler (the §J release gate).
//
// CORS is open (`*`) on these endpoints ON PURPOSE: an external OB 3.0 / VC
// verifier (often browser-based) must be able to GET the DID document, the
// issuer profile, the hosted assertion, and the status list to verify a badge
// "at a public URL". They carry NO PII and NO secrets — only public credential
// data + public keys + the revocation bitstring.
// ============================================================================

/** Media type for a Verifiable Credential as JSON-LD (VCDM 2.0). */
export const VC_MEDIA_TYPE = 'application/vc+ld+json';
/** Media type for a did:web DID document. */
export const DID_MEDIA_TYPE = 'application/did+ld+json';

const PUBLIC_CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export interface JsonResponseInit {
  contentType?: string;
  /** Cache-Control max-age in seconds. */
  maxAge?: number;
  status?: number;
}

/** A public, CORS-enabled JSON(-LD) response. */
export function jsonResponse(body: unknown, init: JsonResponseInit = {}): Response {
  const { contentType = 'application/json', maxAge = 300, status = 200 } = init;
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': contentType,
      'cache-control': `public, max-age=${maxAge}`,
      ...PUBLIC_CORS,
    },
  });
}

/** The did:web DID document (long cache — keys are stable; rotation adds, never drops). */
export function didDocumentResponse(didDocument: unknown): Response {
  return jsonResponse(didDocument, { contentType: DID_MEDIA_TYPE, maxAge: 3600 });
}

/** The OB 3.0 issuer Profile. */
export function issuerProfileResponse(profile: unknown): Response {
  return jsonResponse(profile, { contentType: VC_MEDIA_TYPE, maxAge: 3600 });
}

/** A hosted, verifiable credential assertion. */
export function assertionResponse(credential: unknown): Response {
  return jsonResponse(credential, { contentType: VC_MEDIA_TYPE, maxAge: 600 });
}

/**
 * The hosted BitstringStatusList credential. SHORT cache: a revocation MUST
 * propagate to verifiers quickly ("badge on a retired version flips to recert
 * required" has to be visible), so we cap how long a stale list can be served.
 */
export function statusListResponse(statusListCredential: unknown): Response {
  return jsonResponse(statusListCredential, { contentType: VC_MEDIA_TYPE, maxAge: 60 });
}

/** Preflight for browser verifiers. */
export function corsPreflightResponse(): Response {
  return new Response(null, { status: 204, headers: PUBLIC_CORS });
}

export function notFoundResponse(message = 'not_found'): Response {
  return jsonResponse({ error: message }, { status: 404, maxAge: 0 });
}

export function methodNotAllowedResponse(): Response {
  return jsonResponse({ error: 'method_not_allowed' }, { status: 405, maxAge: 0 });
}
