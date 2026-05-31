// ============================================================================
// packages/credentials/src/status-list.ts
//
// BitstringStatusList (a.k.a. StatusList2021) — the hosted revocation mechanism
// (ledger §F). A verifier fetches the published, SIGNED status-list credential,
// decompresses its `encodedList`, and reads the bit at the credential's
// `statusListIndex`: bit set ⇒ the status (revocation) applies. Flipping that
// bit IS the revocation primitive — "a badge earned on a retired course version
// flips to recert_required" updates this list so verifiers see the change.
//
// Encoding (per the W3C BitstringStatusList spec):
//   encodedList = multibase-base64url-no-pad('u', GZIP(bitstring))
// Minimum length 131,072 bits (16 KiB) for herd-privacy. GZIP via the
// Web-standard CompressionStream → identical under Node and Deno.
// ============================================================================
import { toMultibase64url, fromMultibase64url } from './multibase';
import { signJsonLd, type SignOptions } from './eddsa-rdfc-2022';
import { type DataIntegrityProof } from './credential.types';
import { type Issuer } from './credential.types';

/** W3C-mandated minimum bitstring length (bits). */
export const MIN_LIST_LENGTH = 131072;

export type StatusPurpose = 'revocation' | 'suspension';

/** Allocate a zeroed bitstring of `length` bits (default minimum). */
export function createBitstring(length: number = MIN_LIST_LENGTH): Uint8Array {
  if (length % 8 !== 0) throw new Error('bitstring length must be a multiple of 8');
  return new Uint8Array(length / 8);
}

function assertIndex(bytes: Uint8Array, index: number): void {
  if (!Number.isInteger(index) || index < 0) throw new Error(`invalid status index: ${index}`);
  if (index >= bytes.length * 8) throw new Error(`status index out of range: ${index}`);
}

/** Read the bit at `index` (true ⇒ status applies, e.g. revoked). */
export function getBit(bytes: Uint8Array, index: number): boolean {
  assertIndex(bytes, index);
  const byte = bytes[index >>> 3]!;
  // Most-significant-bit-first within each byte (per spec).
  return (byte & (0x80 >>> (index & 7))) !== 0;
}

/** Set/clear the bit at `index`. Returns the same buffer (mutated). */
export function setBit(bytes: Uint8Array, index: number, value: boolean): Uint8Array {
  assertIndex(bytes, index);
  const pos = index >>> 3;
  const mask = 0x80 >>> (index & 7);
  if (value) bytes[pos] = bytes[pos]! | mask;
  else bytes[pos] = bytes[pos]! & ~mask;
  return bytes;
}

async function gzip(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  void writer.write(data as unknown as Uint8Array<ArrayBuffer>);
  void writer.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  void writer.write(data as unknown as Uint8Array<ArrayBuffer>);
  void writer.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

/** bitstring → `encodedList` ('u' + base64url(GZIP(bitstring))). */
export async function encodeList(bytes: Uint8Array): Promise<string> {
  return toMultibase64url(await gzip(bytes));
}

/** `encodedList` → bitstring. */
export async function decodeList(encodedList: string): Promise<Uint8Array> {
  return gunzip(fromMultibase64url(encodedList));
}

/** Convenience: decode + read one bit. */
export async function isRevoked(encodedList: string, index: number): Promise<boolean> {
  return getBit(await decodeList(encodedList), index);
}

export interface StatusListCredentialInput {
  /** The status-list credential id (its public URL). */
  id: string;
  /** Issuer DID (string) or Issuer object — normalized to the DID string, since
   *  the status-list credential carries ONLY the vc-v2 context (no OB `Profile`). */
  issuer: string | Issuer;
  encodedList: string;
  statusPurpose?: StatusPurpose;
  validFrom: string;
}

/** The UNSIGNED BitstringStatusListCredential (sign it with signJsonLd to publish). */
export function buildStatusListCredential(
  input: StatusListCredentialInput,
): Record<string, unknown> & { '@context': string[] } {
  return {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    id: input.id,
    type: ['VerifiableCredential', 'BitstringStatusListCredential'],
    issuer: typeof input.issuer === 'string' ? input.issuer : input.issuer.id,
    validFrom: input.validFrom,
    credentialSubject: {
      id: `${input.id}#list`,
      type: 'BitstringStatusList',
      statusPurpose: input.statusPurpose ?? 'revocation',
      encodedList: input.encodedList,
    },
  };
}

/** Build AND sign the BitstringStatusListCredential in one step. */
export async function signStatusListCredential(
  input: StatusListCredentialInput,
  opts: SignOptions,
): Promise<Record<string, unknown> & { proof: DataIntegrityProof }> {
  return signJsonLd(buildStatusListCredential(input), opts);
}

/** Build the `credentialStatus` entry a credential embeds to point at the list. */
export function buildStatusEntry(opts: {
  statusListCredentialUrl: string;
  index: number;
  statusPurpose?: StatusPurpose;
}): {
  id: string;
  type: 'BitstringStatusListEntry';
  statusPurpose: StatusPurpose;
  statusListIndex: string;
  statusListCredential: string;
} {
  return {
    id: `${opts.statusListCredentialUrl}#${opts.index}`,
    type: 'BitstringStatusListEntry',
    statusPurpose: opts.statusPurpose ?? 'revocation',
    statusListIndex: String(opts.index),
    statusListCredential: opts.statusListCredentialUrl,
  };
}
