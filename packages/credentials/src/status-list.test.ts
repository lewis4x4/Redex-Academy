import { describe, it, expect } from 'vitest';
import {
  MIN_LIST_LENGTH,
  createBitstring,
  getBit,
  setBit,
  encodeList,
  decodeList,
  isRevoked,
  buildStatusListCredential,
  signStatusListCredential,
  buildStatusEntry,
} from './status-list';
import { verifyJsonLd, generateKeyPair } from './eddsa-rdfc-2022';
import { TEST_SEED, TEST_VERIFICATION_METHOD, TEST_CREATED } from './test-vector';

describe('BitstringStatusList bit ops', () => {
  it('allocates the W3C minimum length by default', () => {
    expect(createBitstring().length).toBe(MIN_LIST_LENGTH / 8);
  });

  it('sets/reads bits most-significant-first within a byte', () => {
    const b = createBitstring(16);
    setBit(b, 0, true);
    expect(b[0]).toBe(0x80); // bit 0 = MSB of byte 0
    setBit(b, 7, true);
    expect(b[0]).toBe(0x81);
    setBit(b, 8, true);
    expect(b[1]).toBe(0x80);
    expect(getBit(b, 0)).toBe(true);
    expect(getBit(b, 7)).toBe(true);
    expect(getBit(b, 8)).toBe(true);
    expect(getBit(b, 1)).toBe(false);
    setBit(b, 0, false);
    expect(getBit(b, 0)).toBe(false);
  });

  it('rejects out-of-range indices', () => {
    const b = createBitstring(16);
    expect(() => getBit(b, 16)).toThrow();
    expect(() => setBit(b, -1, true)).toThrow();
  });
});

describe('BitstringStatusList encode/decode', () => {
  it('round-trips through gzip + multibase base64url', async () => {
    const b = createBitstring();
    setBit(b, 7, true);
    setBit(b, 130000, true);
    const enc = await encodeList(b);
    expect(enc.startsWith('u')).toBe(true);
    const back = await decodeList(enc);
    expect(getBit(back, 7)).toBe(true);
    expect(getBit(back, 130000)).toBe(true);
    expect(getBit(back, 8)).toBe(false);
  });

  it('isRevoked reads the bit at the index', async () => {
    const b = createBitstring();
    setBit(b, 42, true);
    const enc = await encodeList(b);
    expect(await isRevoked(enc, 42)).toBe(true);
    expect(await isRevoked(enc, 43)).toBe(false);
  });
});

describe('status-list credential + entry', () => {
  it('builds a signed, verifiable BitstringStatusListCredential', async () => {
    const kp = generateKeyPair(TEST_SEED);
    const b = createBitstring();
    setBit(b, 7, true);
    const encodedList = await encodeList(b);
    const signed = await signStatusListCredential(
      {
        id: 'https://academy.redex.education/status/1',
        issuer: { id: 'did:web:academy.redex.education', type: ['Profile'] },
        encodedList,
        validFrom: TEST_CREATED,
      },
      {
        privateKey: TEST_SEED,
        verificationMethod: TEST_VERIFICATION_METHOD,
        created: TEST_CREATED,
      },
    );
    expect((signed.type as string[]).includes('BitstringStatusListCredential')).toBe(true);
    const result = await verifyJsonLd(signed as never, { publicKey: kp.publicKey });
    expect(result.verified).toBe(true);
  });

  it('buildStatusEntry points at the right index + list', () => {
    const e = buildStatusEntry({
      statusListCredentialUrl: 'https://academy.redex.education/status/1',
      index: 7,
    });
    expect(e.type).toBe('BitstringStatusListEntry');
    expect(e.statusListIndex).toBe('7');
    expect(e.id).toBe('https://academy.redex.education/status/1#7');
    expect(e.statusPurpose).toBe('revocation');
  });

  it('unsigned status-list credential carries the encodedList in its subject', () => {
    const c = buildStatusListCredential({
      id: 'https://academy.redex.education/status/1',
      issuer: { id: 'did:web:academy.redex.education', type: ['Profile'] },
      encodedList: 'uH4sIAAAA',
      validFrom: TEST_CREATED,
    });
    const subject = c.credentialSubject as Record<string, unknown>;
    expect(subject.type).toBe('BitstringStatusList');
    expect(subject.statusPurpose).toBe('revocation');
    expect(subject.encodedList).toBe('uH4sIAAAA');
  });
});
