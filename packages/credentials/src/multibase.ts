// ============================================================================
// packages/credentials/src/multibase.ts
//
// Multibase + multicodec primitives for the OB 3.0 / W3C VC issuer (ledger §F).
// PURE, dependency-free, and runtime-neutral on purpose: this leaf module is
// imported by BOTH the Node builder/verifier here AND the Deno `issue-badge`
// Edge Function (by explicit-.ts import) so the base58btc / Multikey encoding
// can never drift between the two signers. Interop with the digitalbazaar
// `eddsa-rdfc-2022` reference suite depends on these exact encodings.
//
//   - proofValue           : multibase base58btc ('z') of the raw 64-byte sig
//   - publicKeyMultibase   : 'z' + base58btc(0xed01 ‖ 32-byte Ed25519 pubkey)
//   - secretKeyMultibase   : 'z' + base58btc(0x8026 ‖ 32-byte Ed25519 seed)   [server-only]
//   - BitstringStatusList  : multibase base64url-no-pad ('u') of the gzipped bitstring
// ============================================================================

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_MAP: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (let i = 0; i < BASE58_ALPHABET.length; i++) m[BASE58_ALPHABET[i]!] = i;
  return m;
})();

/** Multicodec varint prefixes (multiformats table). */
export const MULTICODEC = {
  /** ed25519-pub (0xed) → varint 0xed 0x01 */
  ED25519_PUB: Uint8Array.of(0xed, 0x01),
  /** ed25519-priv (0x1300) → varint 0x80 0x26 */
  ED25519_PRIV: Uint8Array.of(0x80, 0x26),
} as const;

/** Base58btc encode (Bitcoin alphabet), preserving leading-zero bytes as '1'. */
export function base58btcEncode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  // All-zero input: each 0x00 byte is one leading '1' and there is no further
  // value to encode. (Without this, the digit buffer's residual [0] would append
  // an extra '1'. Inert for our keys/signatures — they never start all-zero — but
  // base58btcEncode is a shared primitive, so keep it correct vs the reference.)
  if (zeros === bytes.length) return '1'.repeat(zeros);

  // Convert base-256 → base-58 via repeated division on a digit buffer.
  const digits: number[] = [0];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i]!;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j]! << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  let out = '1'.repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) out += BASE58_ALPHABET[digits[i]!];
  return out;
}

/** Base58btc decode (Bitcoin alphabet), preserving leading '1' as zero bytes. */
export function base58btcDecode(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);
  let zeros = 0;
  while (zeros < str.length && str[zeros] === '1') zeros++;
  // All-'1' input decodes to exactly N zero bytes (symmetric with the encoder).
  if (zeros === str.length) return new Uint8Array(zeros);

  const bytes: number[] = [0];
  for (let i = zeros; i < str.length; i++) {
    const value = BASE58_MAP[str[i]!];
    if (value === undefined) throw new Error(`invalid base58 character: ${str[i]}`);
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j]! * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) out[zeros + i] = bytes[bytes.length - 1 - i]!;
  return out;
}

/** Multibase base58btc: 'z' prefix. */
export function toMultibase58btc(bytes: Uint8Array): string {
  return 'z' + base58btcEncode(bytes);
}

/** Decode a 'z'-prefixed multibase base58btc string. */
export function fromMultibase58btc(str: string): Uint8Array {
  if (str[0] !== 'z') throw new Error(`expected multibase base58btc ('z' prefix), got: ${str[0]}`);
  return base58btcDecode(str.slice(1));
}

/** Concatenate a multicodec prefix with a raw key and multibase-base58btc it. */
export function encodeMultikey(prefix: Uint8Array, raw: Uint8Array): string {
  const out = new Uint8Array(prefix.length + raw.length);
  out.set(prefix, 0);
  out.set(raw, prefix.length);
  return toMultibase58btc(out);
}

/** Strip a known multicodec prefix from a decoded Multikey; throws on mismatch. */
export function decodeMultikey(multibase: string, expectedPrefix: Uint8Array): Uint8Array {
  const decoded = fromMultibase58btc(multibase);
  for (let i = 0; i < expectedPrefix.length; i++) {
    if (decoded[i] !== expectedPrefix[i])
      throw new Error('unexpected multicodec prefix for Multikey');
  }
  return decoded.slice(expectedPrefix.length);
}

export const ed25519PublicKeyMultibase = (pub: Uint8Array): string =>
  encodeMultikey(MULTICODEC.ED25519_PUB, pub);
export const ed25519SecretKeyMultibase = (seed: Uint8Array): string =>
  encodeMultikey(MULTICODEC.ED25519_PRIV, seed);
export const decodeEd25519PublicKeyMultibase = (mb: string): Uint8Array =>
  decodeMultikey(mb, MULTICODEC.ED25519_PUB);
export const decodeEd25519SecretKeyMultibase = (mb: string): Uint8Array =>
  decodeMultikey(mb, MULTICODEC.ED25519_PRIV);

// ---- base64url (no padding), used for the BitstringStatusList encodedList ----

/** RFC 4648 §5 base64url, no padding. */
export function base64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  // btoa is available in Node 18+, Deno, and browsers.
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode base64url (no padding). */
export function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Multibase base64url-no-pad: 'u' prefix (BitstringStatusList encodedList). */
export function toMultibase64url(bytes: Uint8Array): string {
  return 'u' + base64urlEncode(bytes);
}

/** Decode a 'u'-prefixed multibase base64url string. */
export function fromMultibase64url(str: string): Uint8Array {
  if (str[0] !== 'u') throw new Error(`expected multibase base64url ('u' prefix), got: ${str[0]}`);
  return base64urlDecode(str.slice(1));
}
