// ============================================================================
// packages/credentials/src/did-web.ts
//
// did:web issuer profile + DID document helpers. The DID document is what an
// external verifier resolves to obtain the issuer's PUBLIC keys; it lists
// CURRENT *and* RETIRED keys so proofs signed before a rotation keep verifying
// (ledger §F key-rotation requirement). Private keys NEVER appear here.
// ============================================================================
import { DEFAULT_ISSUER_DID, resolveIssuerEndpoints } from './issuer-config';
import { decodeEd25519PublicKeyMultibase } from './multibase';

export type KeyStatus = 'current' | 'retired';

export interface IssuerKey {
  /** Fragment id, e.g. `key-2026-05` → verificationMethod `did#key-2026-05`. */
  id: string;
  publicKeyMultibase: string;
  status: KeyStatus;
  /** ISO timestamp the key was retired (informational; present when retired). */
  retiredAt?: string;
}

export interface DidDocument {
  '@context': string[];
  id: string;
  verificationMethod: Array<{
    id: string;
    type: 'Multikey';
    controller: string;
    publicKeyMultibase: string;
  }>;
  /** Keys authorized to assert credentials. Retired keys STAY listed so old proofs verify. */
  assertionMethod: string[];
}

/** Full verificationMethod id for a key fragment under an issuer DID. */
export function verificationMethodId(did: string, keyId: string): string {
  return `${did}#${keyId}`;
}

/**
 * Build the did:web DID document. CURRENT and RETIRED keys are both published
 * (and both kept under assertionMethod) so a verifier can resolve the key a
 * historical proof referenced even after the issuer rotated to a new signer.
 */
export function buildDidDocument(keys: IssuerKey[], did: string = DEFAULT_ISSUER_DID): DidDocument {
  if (keys.length === 0) throw new Error('issuer DID document needs at least one key');
  if (!keys.some((k) => k.status === 'current')) {
    throw new Error('issuer DID document needs at least one CURRENT key to sign with');
  }
  return {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/multikey/v1'],
    id: did,
    verificationMethod: keys.map((k) => ({
      id: verificationMethodId(did, k.id),
      type: 'Multikey' as const,
      controller: did,
      publicKeyMultibase: k.publicKeyMultibase,
    })),
    assertionMethod: keys.map((k) => verificationMethodId(did, k.id)),
  };
}

/**
 * The OB 3.0 issuer `Profile` document served at the profile URL. Points back
 * at the DID document and (re-)publishes the key list for OB-aware verifiers.
 */
export function buildIssuerProfile(opts: {
  did?: string;
  name: string;
  description?: string;
  url?: string;
  keys: IssuerKey[];
}): Record<string, unknown> {
  const did = opts.did ?? DEFAULT_ISSUER_DID;
  const ep = resolveIssuerEndpoints(did);
  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
    ],
    id: did,
    type: ['Profile'],
    name: opts.name,
    ...(opts.description ? { description: opts.description } : {}),
    url: opts.url ?? ep.origin,
    verificationMethod: buildDidDocument(opts.keys, did).verificationMethod,
  };
}

export interface ResolvedVerificationMethod {
  id: string;
  controller: string;
  publicKey: Uint8Array;
}

/** Resolve a verificationMethod id against a DID document → raw Ed25519 public key. */
export function resolveVerificationMethod(
  didDocument: DidDocument,
  verificationMethod: string,
): ResolvedVerificationMethod {
  const vm = didDocument.verificationMethod.find((m) => m.id === verificationMethod);
  if (!vm) {
    throw new Error(`verificationMethod not found in DID document: ${verificationMethod}`);
  }
  if (vm.type !== 'Multikey') {
    throw new Error(`unsupported verificationMethod type: ${vm.type}`);
  }
  if (!didDocument.assertionMethod.includes(verificationMethod)) {
    throw new Error(
      `verificationMethod is not authorized for assertionMethod: ${verificationMethod}`,
    );
  }
  return {
    id: vm.id,
    controller: vm.controller,
    publicKey: decodeEd25519PublicKeyMultibase(vm.publicKeyMultibase),
  };
}
