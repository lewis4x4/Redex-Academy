import { describe, it, expect } from 'vitest';
import {
  base58btcEncode,
  base58btcDecode,
  toMultibase58btc,
  fromMultibase58btc,
  base64urlEncode,
  base64urlDecode,
  ed25519PublicKeyMultibase,
  decodeEd25519PublicKeyMultibase,
  ed25519SecretKeyMultibase,
  decodeEd25519SecretKeyMultibase,
  MULTICODEC,
} from './multibase';

describe('base58btc', () => {
  it('matches known Bitcoin-alphabet vectors', () => {
    expect(base58btcEncode(new TextEncoder().encode('Hello World!'))).toBe('2NEpo7TZRRrLZSi2U');
    expect(new TextDecoder().decode(base58btcDecode('2NEpo7TZRRrLZSi2U'))).toBe('Hello World!');
  });

  it('preserves leading zero bytes as "1"', () => {
    const bytes = new Uint8Array([0, 0, 1, 2, 3]);
    const enc = base58btcEncode(bytes);
    expect(enc.startsWith('11')).toBe(true);
    expect(Array.from(base58btcDecode(enc))).toEqual([0, 0, 1, 2, 3]);
  });

  it('encodes all-zero input as exactly N ones (no off-by-one)', () => {
    expect(base58btcEncode(Uint8Array.of(0))).toBe('1');
    expect(base58btcEncode(new Uint8Array(64))).toBe('1'.repeat(64));
    expect(Array.from(base58btcDecode('1'.repeat(64)))).toEqual(Array.from(new Uint8Array(64)));
  });

  it('round-trips random buffers', () => {
    for (let i = 0; i < 50; i++) {
      const b = crypto.getRandomValues(new Uint8Array(1 + (i % 40)));
      expect(Array.from(base58btcDecode(base58btcEncode(b)))).toEqual(Array.from(b));
    }
  });

  it('multibase z-prefix round-trips and rejects bad prefix', () => {
    const b = new Uint8Array([9, 8, 7]);
    expect(fromMultibase58btc(toMultibase58btc(b))).toEqual(b);
    expect(() => fromMultibase58btc('x123')).toThrow();
  });
});

describe('base64url', () => {
  it('encodes without padding and round-trips', () => {
    const b = new Uint8Array([251, 255, 191]);
    const enc = base64urlEncode(b);
    expect(enc).not.toContain('=');
    expect(enc).not.toMatch(/[+/]/);
    expect(Array.from(base64urlDecode(enc))).toEqual(Array.from(b));
  });
});

describe('Ed25519 Multikey', () => {
  it('encodes the ed25519-pub multicodec prefix and round-trips', () => {
    const pub = crypto.getRandomValues(new Uint8Array(32));
    const mb = ed25519PublicKeyMultibase(pub);
    expect(mb.startsWith('z6Mk')).toBe(true); // canonical Ed25519 Multikey prefix
    expect(Array.from(decodeEd25519PublicKeyMultibase(mb))).toEqual(Array.from(pub));
  });

  it('encodes the ed25519-priv multicodec prefix and round-trips', () => {
    const seed = crypto.getRandomValues(new Uint8Array(32));
    const mb = ed25519SecretKeyMultibase(seed);
    expect(Array.from(decodeEd25519SecretKeyMultibase(mb))).toEqual(Array.from(seed));
  });

  it('rejects a public multibase decoded with the private prefix', () => {
    const pub = crypto.getRandomValues(new Uint8Array(32));
    expect(() => decodeEd25519SecretKeyMultibase(ed25519PublicKeyMultibase(pub))).toThrow();
  });

  it('uses the documented multicodec prefixes', () => {
    expect(Array.from(MULTICODEC.ED25519_PUB)).toEqual([0xed, 0x01]);
    expect(Array.from(MULTICODEC.ED25519_PRIV)).toEqual([0x80, 0x26]);
  });
});
