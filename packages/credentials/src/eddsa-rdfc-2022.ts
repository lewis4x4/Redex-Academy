// ============================================================================
// packages/credentials/src/eddsa-rdfc-2022.ts
//
// The pinned proof suite (ledger §F / invariant 7): a W3C Data Integrity
// `DataIntegrityProof` with cryptosuite `eddsa-rdfc-2022` over Ed25519.
//
// Algorithm (per the W3C "Data Integrity EdDSA Cryptosuites" spec, rdfc variant):
//   1. proofConfig = the proof object WITHOUT proofValue, carrying the
//      document's @context.
//   2. canonicalProofConfig = RDFC-1.0 / URDNA2015 canonicalization → N-Quads.
//   3. canonicalDocument    = RDFC canonicalization of the doc WITHOUT `proof`.
//   4. hashData = SHA-256(canonicalProofConfig) ‖ SHA-256(canonicalDocument)
//      (proof-config hash FIRST — this ordering is what the digitalbazaar
//       reference suite uses; pinned by the conformance test).
//   5. signature = Ed25519.sign(hashData, privateKey).
//   6. proofValue = multibase-base58btc('z') of the 64-byte signature.
//
// Pure JS (jsonld + @noble/ed25519 + WebCrypto SHA-256) so it runs UNCHANGED
// under Deno inside the issue-badge Edge Function (the resolved Path A — see
// CLAUDE.md / ADR-0005). Canonicalization uses a STATIC offline loader: no
// network at sign/verify time. SIGNING IS SERVER-ONLY (invariant 2).
// ============================================================================
import jsonld from 'jsonld';
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { PROOF_SUITE } from './issuer-config';
import { issuerDocumentLoader, type DocumentLoader } from './contexts/index';
import {
  ed25519PublicKeyMultibase,
  ed25519SecretKeyMultibase,
  decodeEd25519SecretKeyMultibase,
  fromMultibase58btc,
  toMultibase58btc,
} from './multibase';
import { resolveVerificationMethod, type DidDocument } from './did-web';
import {
  SignedCredentialSchema,
  type DataIntegrityProof,
  type SignedCredential,
  type UnsignedCredential,
} from './credential.types';

// Wire Ed25519's required SHA-512 (the lib is hash-agnostic by design). Idempotent.
ed.etc.sha512Sync = (...m: Uint8Array[]): Uint8Array => sha512(ed.etc.concatBytes(...m));

const te = new TextEncoder();

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return new Uint8Array(digest);
}

async function canonize(doc: unknown, documentLoader: DocumentLoader): Promise<string> {
  return jsonld.canonize(doc, {
    algorithm: 'URDNA2015',
    format: 'application/n-quads',
    documentLoader,
    safe: true,
  });
}

type ProofConfig = Omit<DataIntegrityProof, 'proofValue'> & { '@context': unknown };

function buildProofConfig(
  context: unknown,
  verificationMethod: string,
  created: string,
): ProofConfig {
  return {
    '@context': context,
    type: 'DataIntegrityProof',
    cryptosuite: PROOF_SUITE,
    created,
    verificationMethod,
    proofPurpose: 'assertionMethod',
  };
}

/** hashData = SHA-256(c14n proofConfig) ‖ SHA-256(c14n document-without-proof). */
async function computeHashData(
  unsignedDoc: Record<string, unknown>,
  proofConfig: ProofConfig,
  documentLoader: DocumentLoader,
): Promise<Uint8Array> {
  const [proofHash, docHash] = await Promise.all([
    canonize(proofConfig, documentLoader).then((nq) => sha256(te.encode(nq))),
    canonize(unsignedDoc, documentLoader).then((nq) => sha256(te.encode(nq))),
  ]);
  const out = new Uint8Array(proofHash.length + docHash.length);
  out.set(proofHash, 0);
  out.set(docHash, proofHash.length);
  return out;
}

export interface SignOptions {
  /** Raw 32-byte Ed25519 private seed. NEVER leaves the server / Vault. */
  privateKey: Uint8Array;
  /** Full verificationMethod id, e.g. `did:web:academy.redex.education#key-2026-05`. */
  verificationMethod: string;
  /** ISO 8601 proof creation time (passed in → deterministic + testable). */
  created: string;
  documentLoader?: DocumentLoader;
}

type JsonLdDoc = Record<string, unknown> & { '@context': unknown };

/** Core signer — attaches an eddsa-rdfc-2022 Data Integrity proof to ANY JSON-LD
 *  document (a credential OR the BitstringStatusList credential). */
export async function signJsonLd<T extends JsonLdDoc>(
  doc: T,
  opts: SignOptions,
): Promise<T & { proof: DataIntegrityProof }> {
  if ('proof' in doc) {
    throw new Error('refusing to sign a document that already carries a proof');
  }
  const loader = opts.documentLoader ?? issuerDocumentLoader;
  const proofConfig = buildProofConfig(doc['@context'], opts.verificationMethod, opts.created);
  const hashData = await computeHashData(doc, proofConfig, loader);
  const signature = ed.sign(hashData, opts.privateKey);

  const proof: DataIntegrityProof = {
    type: 'DataIntegrityProof',
    cryptosuite: PROOF_SUITE,
    created: opts.created,
    verificationMethod: opts.verificationMethod,
    proofPurpose: 'assertionMethod',
    proofValue: toMultibase58btc(signature),
  };
  return { ...doc, proof };
}

/** Sign an unsigned credential → a validated, signed AchievementCredential. */
export async function signCredential(
  unsignedDoc: UnsignedCredential,
  opts: SignOptions,
): Promise<SignedCredential> {
  const signed = await signJsonLd(unsignedDoc as unknown as JsonLdDoc, opts);
  return SignedCredentialSchema.parse(signed);
}

export interface VerifyOptions {
  /** Provide the raw public key directly, OR a DID document to resolve it from. */
  publicKey?: Uint8Array;
  didDocument?: DidDocument;
  documentLoader?: DocumentLoader;
}

export interface VerifyResult {
  verified: boolean;
  errors: string[];
  verificationMethod?: string;
}

/** Verify an eddsa-rdfc-2022 proof on ANY signed JSON-LD document. Re-canonicalizes
 *  from scratch — no trust in the signer's bytes beyond the embedded proofValue. */
export async function verifyJsonLd(
  signedDoc: JsonLdDoc & { proof: DataIntegrityProof },
  opts: VerifyOptions,
): Promise<VerifyResult> {
  const errors: string[] = [];
  try {
    const { proof, ...unsigned } = signedDoc;
    if (proof?.type !== 'DataIntegrityProof') errors.push('proof.type is not DataIntegrityProof');
    if (proof?.cryptosuite !== PROOF_SUITE) errors.push(`cryptosuite is not ${PROOF_SUITE}`);
    if (proof?.proofPurpose !== 'assertionMethod')
      errors.push('proofPurpose is not assertionMethod');
    if (errors.length) return { verified: false, errors };

    let publicKey = opts.publicKey;
    if (!publicKey) {
      if (!opts.didDocument) {
        return { verified: false, errors: ['no publicKey and no didDocument supplied'] };
      }
      publicKey = resolveVerificationMethod(opts.didDocument, proof.verificationMethod).publicKey;
    }

    const loader = opts.documentLoader ?? issuerDocumentLoader;
    const proofConfig = buildProofConfig(
      unsigned['@context'],
      proof.verificationMethod,
      proof.created,
    );
    const hashData = await computeHashData(unsigned as JsonLdDoc, proofConfig, loader);
    const signature = fromMultibase58btc(proof.proofValue);
    const verified = ed.verify(signature, hashData, publicKey);
    return {
      verified,
      errors: verified ? [] : ['Ed25519 signature verification failed'],
      verificationMethod: proof.verificationMethod,
    };
  } catch (err) {
    return { verified: false, errors: [(err as Error).message] };
  }
}

/** Verify an eddsa-rdfc-2022 proof on a signed AchievementCredential. */
export function verifyCredential(
  signedDoc: SignedCredential,
  opts: VerifyOptions,
): Promise<VerifyResult> {
  return verifyJsonLd(signedDoc as unknown as JsonLdDoc & { proof: DataIntegrityProof }, opts);
}

// ---- key generation (server / runbook use) ----

export interface GeneratedKeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  publicKeyMultibase: string;
  /** Multikey-encoded private seed for Vault storage. NEVER published/logged. */
  secretKeyMultibase: string;
}

/** Generate an Ed25519 key pair from an optional 32-byte seed (deterministic in tests). */
export function generateKeyPair(seed?: Uint8Array): GeneratedKeyPair {
  const privateKey = seed ?? ed.utils.randomPrivateKey();
  if (privateKey.length !== 32) throw new Error('Ed25519 seed must be 32 bytes');
  const publicKey = ed.getPublicKey(privateKey);
  return {
    privateKey,
    publicKey,
    publicKeyMultibase: ed25519PublicKeyMultibase(publicKey),
    secretKeyMultibase: ed25519SecretKeyMultibase(privateKey),
  };
}

/** Recover a signing key pair from a Vault-held secretKeyMultibase. */
export function keyPairFromSecretMultibase(secretKeyMultibase: string): GeneratedKeyPair {
  const privateKey = decodeEd25519SecretKeyMultibase(secretKeyMultibase);
  return generateKeyPair(privateKey);
}
