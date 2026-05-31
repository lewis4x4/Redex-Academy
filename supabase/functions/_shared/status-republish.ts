// ============================================================================
// supabase/functions/_shared/status-republish.ts  (Deno) — M7
//
// Rebuilds + re-signs the hosted BitstringStatusList credential on revocation, so
// a flipped status actually REACHES a verifier (the credential a verifier fetches
// is regenerated from the current revoked set). Self-contained Deno bit/codec ops
// (the F6 status-list.ts equivalents — same MSB-first BitstringStatusList encoding
// per the W3C spec; not importable across the Node/Deno extension boundary, so
// kept thin here, reusing the multibase leaf + the proven Deno signer).
//
// SIGNING IS SERVER-ONLY — the re-signed list carries an eddsa-rdfc-2022 proof
// from the Vault key (same custody as issuance). Publishing the returned list to
// the status-list Worker's KV is the deploy step (the §J release gate), exactly
// as hosted-assertion publishing is for issuance.
// ============================================================================
import { signCredential, loadSigningKey, type SignOptions } from './credential-signer.ts';
import {
  toMultibase64url,
  fromMultibase64url,
} from '../../../packages/credentials/src/multibase.ts';
import type { IssuerEndpoints } from '../../../packages/credentials/src/issuer-config.ts';

/** W3C-mandated minimum bitstring length (bits) — herd privacy. */
export const MIN_LIST_LENGTH = 131072;

export function createBitstring(length: number = MIN_LIST_LENGTH): Uint8Array {
  return new Uint8Array(length / 8);
}

export function setBit(bytes: Uint8Array, index: number, value: boolean): void {
  if (index < 0 || index >= bytes.length * 8) throw new Error(`status index out of range: ${index}`);
  const mask = 0x80 >>> (index & 7); // MSB-first within the byte (per spec)
  if (value) bytes[index >>> 3] = bytes[index >>> 3]! | mask;
  else bytes[index >>> 3] = bytes[index >>> 3]! & ~mask;
}

export function getBit(bytes: Uint8Array, index: number): boolean {
  if (index < 0 || index >= bytes.length * 8) throw new Error(`status index out of range: ${index}`);
  return (bytes[index >>> 3]! & (0x80 >>> (index & 7))) !== 0;
}

async function gzip(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip');
  const w = cs.writable.getWriter();
  void w.write(data as unknown as Uint8Array<ArrayBuffer>);
  void w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip');
  const w = ds.writable.getWriter();
  void w.write(data as unknown as Uint8Array<ArrayBuffer>);
  void w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

/** Build `encodedList` ('u' + base64url(GZIP(bitstring))) from the revoked indices. */
export async function encodeRevocationList(revokedIndices: readonly number[]): Promise<string> {
  const bits = createBitstring();
  for (const i of revokedIndices) setBit(bits, i, true);
  return toMultibase64url(await gzip(bits));
}

/** Read whether `index` is revoked in an `encodedList` (for verifiers + tests). */
export async function isIndexRevoked(encodedList: string, index: number): Promise<boolean> {
  return getBit(await gunzip(fromMultibase64url(encodedList)), index);
}

export interface RepublishContext {
  issuer: { did: string; keyId: string; secretKeyMultibase: string };
  endpoints: IssuerEndpoints;
  created: string;
}

/**
 * Rebuild the BitstringStatusListCredential from the CURRENT revoked indices and
 * SIGN it (eddsa-rdfc-2022). This is the artifact a verifier fetches; publishing it
 * to the status-list Worker's KV is the deploy step. Returns the signed credential.
 */
export async function signStatusListCredential(
  revokedIndices: readonly number[],
  ctx: RepublishContext,
): Promise<Record<string, unknown>> {
  const encodedList = await encodeRevocationList(revokedIndices);
  const statusListCredential = {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    id: ctx.endpoints.statusListUrl,
    type: ['VerifiableCredential', 'BitstringStatusListCredential'],
    issuer: ctx.issuer.did,
    validFrom: ctx.created,
    credentialSubject: {
      id: `${ctx.endpoints.statusListUrl}#list`,
      type: 'BitstringStatusList',
      statusPurpose: 'revocation',
      encodedList,
    },
  };
  const { privateKey } = loadSigningKey(ctx.issuer.secretKeyMultibase);
  const opts: SignOptions = {
    privateKey,
    verificationMethod: `${ctx.issuer.did}#${ctx.issuer.keyId}`,
    created: ctx.created,
  };
  return signCredential(statusListCredential, opts);
}
