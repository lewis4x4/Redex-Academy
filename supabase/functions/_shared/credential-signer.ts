// ============================================================================
// supabase/functions/_shared/credential-signer.ts  (Deno) — F6
//
// The DENO side of the eddsa-rdfc-2022 issuer. The resolved Deno-vs-Node
// decision is PATH A (CLAUDE.md §F-decision / ADR-0005): a Deno-compatible
// signer co-located with the Vault key inside the issue-badge Edge Function —
// jsonld (URDNA2015 canonicalization) + @noble/ed25519 + WebCrypto SHA-256,
// with a STATIC offline document loader (no network at sign time).
//
// It REUSES the @redex/credentials LEAF modules (vendored contexts + multibase)
// by direct import so those can never drift, and DUPLICATES only the thin
// build+canonize+sign orchestration here. Both implementations are pinned to a
// single byte-for-byte proofValue by the deterministic test vector
// (handler.test.ts asserts EXPECTED_PROOF_VALUE — see ../../packages/credentials
// /src/test-vector-data.ts). SIGNING IS SERVER-ONLY (invariant 2/7); the private
// key is read from the function env (Supabase Vault), never a client bundle.
// ============================================================================
import jsonld from 'jsonld';
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';

import VC_V2 from '../../../packages/credentials/src/contexts/vc-v2.ts';
import OB_V3P0 from '../../../packages/credentials/src/contexts/ob-v3p0.ts';
import {
  toMultibase58btc,
  fromMultibase58btc,
  ed25519PublicKeyMultibase,
  decodeEd25519SecretKeyMultibase,
} from '../../../packages/credentials/src/multibase.ts';

ed.etc.sha512Sync = (...m: Uint8Array[]): Uint8Array => sha512(ed.etc.concatBytes(...m));

export const PROOF_SUITE = 'eddsa-rdfc-2022' as const;
export const CREDENTIAL_CONTEXT = [
  'https://www.w3.org/ns/credentials/v2',
  'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
];

const PINNED: Record<string, unknown> = {
  'https://www.w3.org/ns/credentials/v2': VC_V2,
  'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json': OB_V3P0,
};

// deno-lint-ignore no-explicit-any
const staticLoader = (url: string): Promise<any> => {
  const document = PINNED[url];
  if (document === undefined) {
    return Promise.reject(new Error(`refused to load a non-pinned JSON-LD document: ${url}`));
  }
  return Promise.resolve({ contextUrl: undefined, documentUrl: url, document });
};

const te = new TextEncoder();

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource));
}

// deno-lint-ignore no-explicit-any
async function canonize(doc: any): Promise<string> {
  return jsonld.canonize(doc, {
    algorithm: 'URDNA2015',
    format: 'application/n-quads',
    documentLoader: staticLoader,
    safe: true,
  });
}

export interface AchievementInput {
  credentialId: string;
  issuer: { id: string; type?: string[]; name?: string };
  recipientId?: string;
  achievement: {
    id: string;
    type?: string[];
    name: string;
    description?: string;
    criteria?: { narrative?: string; id?: string };
  };
  validFrom: string;
  validUntil?: string;
  name?: string;
  credentialStatus?: Record<string, unknown>;
  evidence?: Array<Record<string, unknown>>;
}

/** Build the UNSIGNED credential. MUST stay structurally identical to the Node
 *  builder (packages/credentials/src/builder.ts) — the test vector enforces it. */
export function buildUnsignedCredential(input: AchievementInput): Record<string, unknown> {
  return {
    '@context': [...CREDENTIAL_CONTEXT],
    id: input.credentialId,
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    issuer: { ...input.issuer, type: input.issuer.type ?? ['Profile'] },
    validFrom: input.validFrom,
    ...(input.validUntil ? { validUntil: input.validUntil } : {}),
    ...(input.name ? { name: input.name } : {}),
    credentialSubject: {
      ...(input.recipientId ? { id: input.recipientId } : {}),
      type: ['AchievementSubject'],
      achievement: { ...input.achievement, type: input.achievement.type ?? ['Achievement'] },
    },
    ...(input.credentialStatus ? { credentialStatus: input.credentialStatus } : {}),
    // Default evidence[].type to ['Evidence'] — MUST match the Node builder, where
    // EvidenceSchema applies the same Zod default. Without this the two builders
    // would canonicalize differently for evidence that omits `type` (parity drift).
    ...(input.evidence
      ? {
          evidence: input.evidence.map((e) => ({
            ...e,
            type: (e.type as string[] | undefined) ?? ['Evidence'],
          })),
        }
      : {}),
  };
}

export interface SignOptions {
  /** Raw 32-byte Ed25519 private seed (decoded from the Vault secretKeyMultibase). */
  privateKey: Uint8Array;
  verificationMethod: string;
  created: string;
}

async function hashData(
  unsignedDoc: Record<string, unknown>,
  verificationMethod: string,
  created: string,
): Promise<Uint8Array> {
  const proofConfig = {
    '@context': unsignedDoc['@context'],
    type: 'DataIntegrityProof',
    cryptosuite: PROOF_SUITE,
    created,
    verificationMethod,
    proofPurpose: 'assertionMethod',
  };
  const [proofHash, docHash] = await Promise.all([
    canonize(proofConfig).then((nq) => sha256(te.encode(nq))),
    canonize(unsignedDoc).then((nq) => sha256(te.encode(nq))),
  ]);
  const out = new Uint8Array(proofHash.length + docHash.length);
  out.set(proofHash, 0);
  out.set(docHash, proofHash.length);
  return out;
}

/** Sign any unsigned JSON-LD credential → an embedded eddsa-rdfc-2022 proof. */
export async function signCredential(
  unsignedDoc: Record<string, unknown>,
  opts: SignOptions,
): Promise<Record<string, unknown>> {
  if ('proof' in unsignedDoc) throw new Error('refusing to sign a document that already has a proof');
  const data = await hashData(unsignedDoc, opts.verificationMethod, opts.created);
  const signature = ed.sign(data, opts.privateKey);
  return {
    ...unsignedDoc,
    proof: {
      type: 'DataIntegrityProof',
      cryptosuite: PROOF_SUITE,
      created: opts.created,
      verificationMethod: opts.verificationMethod,
      proofPurpose: 'assertionMethod',
      proofValue: toMultibase58btc(signature),
    },
  };
}

/** Verify (used by tests + the in-function self-check after signing). */
export async function verifyCredential(
  signedDoc: Record<string, unknown>,
  publicKey: Uint8Array,
): Promise<boolean> {
  const { proof, ...unsigned } = signedDoc as {
    proof: { verificationMethod: string; created: string; proofValue: string };
  } & Record<string, unknown>;
  const data = await hashData(unsigned, proof.verificationMethod, proof.created);
  return ed.verify(fromMultibase58btc(proof.proofValue), data, publicKey);
}

/** Recover the signing key from the Vault-held secretKeyMultibase. */
export function loadSigningKey(secretKeyMultibase: string): {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  publicKeyMultibase: string;
} {
  const privateKey = decodeEd25519SecretKeyMultibase(secretKeyMultibase);
  const publicKey = ed.getPublicKey(privateKey);
  return { privateKey, publicKey, publicKeyMultibase: ed25519PublicKeyMultibase(publicKey) };
}
