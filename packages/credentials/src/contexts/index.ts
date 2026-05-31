// ============================================================================
// packages/credentials/src/contexts/index.ts
//
// STATIC, OFFLINE JSON-LD document loader. eddsa-rdfc-2022 canonicalization
// resolves @context URLs to documents; doing that over the network at sign /
// verify time is BOTH a security hazard (a swapped context changes the meaning
// of a signed claim) AND a Deno-runtime hazard (the F6 trap — jsonld's Node
// http loader pulls undici). So we resolve from VENDORED copies only and
// REFUSE any URL we have not pinned.
//
// The same vendored contexts back the Deno `issue-badge` signer (which imports
// the individual `*.ts` context modules directly) — single source of truth.
// ============================================================================
import VC_V2 from './vc-v2';
import OB_V3P0 from './ob-v3p0';
import DI_V2 from './di-v2';
import MULTIKEY_V1 from './multikey-v1';
import DID_V1 from './did-v1';

export interface RemoteDocument {
  contextUrl?: string | undefined;
  documentUrl: string;
  document: unknown;
}

export type DocumentLoader = (url: string) => Promise<RemoteDocument>;

/** URLs the issuer pins. Resolving anything else is a hard error (no network). */
export const PINNED_CONTEXTS: Readonly<Record<string, unknown>> = {
  'https://www.w3.org/ns/credentials/v2': VC_V2,
  'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json': OB_V3P0,
  'https://w3id.org/security/data-integrity/v2': DI_V2,
  'https://w3id.org/security/multikey/v1': MULTIKEY_V1,
  'https://www.w3.org/ns/did/v1': DID_V1,
};

/**
 * Build a loader over the pinned contexts plus any caller-supplied documents
 * (e.g. a resolved did:web document or a verificationMethod). Never touches the
 * network: an unpinned URL throws.
 */
export function createDocumentLoader(extra: Record<string, unknown> = {}): DocumentLoader {
  const table: Record<string, unknown> = { ...PINNED_CONTEXTS, ...extra };
  return (url: string): Promise<RemoteDocument> => {
    const document = table[url];
    if (document === undefined) {
      return Promise.reject(
        new Error(
          `refused to load a non-pinned JSON-LD document: ${url} ` +
            `(the issuer canonicalizes against vendored contexts ONLY — no network fetch)`,
        ),
      );
    }
    return Promise.resolve({ contextUrl: undefined, documentUrl: url, document });
  };
}

/** The default issuer loader: the pinned contexts, no dynamic docs. */
export const issuerDocumentLoader: DocumentLoader = createDocumentLoader();

export { VC_V2, OB_V3P0, DI_V2, MULTIKEY_V1, DID_V1 };
