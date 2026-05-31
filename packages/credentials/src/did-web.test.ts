import { describe, it, expect } from 'vitest';
import { resolveIssuerEndpoints } from './issuer-config';
import {
  buildDidDocument,
  buildIssuerProfile,
  resolveVerificationMethod,
  verificationMethodId,
} from './did-web';
import { buildAchievementCredential } from './builder';
import { signCredential, verifyCredential, generateKeyPair } from './eddsa-rdfc-2022';
import { TEST_BUILD_INPUT, TEST_CREATED, TEST_ISSUER_DID } from './test-vector';

describe('did:web endpoint resolution', () => {
  it('maps the reconciled issuer DID to its https endpoints', () => {
    const ep = resolveIssuerEndpoints('did:web:academy.redex.education');
    expect(ep.origin).toBe('https://academy.redex.education');
    expect(ep.didDocumentUrl).toBe('https://academy.redex.education/.well-known/did.json');
    expect(ep.profileUrl).toBe('https://academy.redex.education/.well-known/issuer');
    expect(ep.statusListUrl).toBe('https://academy.redex.education/status/1');
  });

  it('handles a did:web with a path', () => {
    const ep = resolveIssuerEndpoints('did:web:example.com:org:123');
    expect(ep.origin).toBe('https://example.com');
    expect(ep.didDocumentUrl).toBe('https://example.com/org/123/did.json');
  });

  it('rejects non did:web issuers', () => {
    expect(() => resolveIssuerEndpoints('did:key:zABC')).toThrow();
  });
});

describe('DID document + issuer profile', () => {
  it('requires at least one current key', () => {
    expect(() => buildDidDocument([])).toThrow();
    const k = generateKeyPair(new Uint8Array(32).fill(3));
    expect(() =>
      buildDidDocument([{ id: 'k1', publicKeyMultibase: k.publicKeyMultibase, status: 'retired' }]),
    ).toThrow(/CURRENT/);
  });

  it('lists current + retired keys in verificationMethod and assertionMethod', () => {
    const cur = generateKeyPair(new Uint8Array(32).fill(1));
    const old = generateKeyPair(new Uint8Array(32).fill(2));
    const doc = buildDidDocument(
      [
        { id: 'k-old', publicKeyMultibase: old.publicKeyMultibase, status: 'retired' },
        { id: 'k-cur', publicKeyMultibase: cur.publicKeyMultibase, status: 'current' },
      ],
      TEST_ISSUER_DID,
    );
    expect(doc.verificationMethod).toHaveLength(2);
    expect(doc.assertionMethod).toContain(verificationMethodId(TEST_ISSUER_DID, 'k-old'));
    expect(doc.assertionMethod).toContain(verificationMethodId(TEST_ISSUER_DID, 'k-cur'));
  });

  it('resolveVerificationMethod returns the key and rejects unknown/unauthorized', () => {
    const k = generateKeyPair(new Uint8Array(32).fill(5));
    const doc = buildDidDocument(
      [{ id: 'k1', publicKeyMultibase: k.publicKeyMultibase, status: 'current' }],
      TEST_ISSUER_DID,
    );
    const vm = verificationMethodId(TEST_ISSUER_DID, 'k1');
    expect(Array.from(resolveVerificationMethod(doc, vm).publicKey)).toEqual(
      Array.from(k.publicKey),
    );
    expect(() => resolveVerificationMethod(doc, `${TEST_ISSUER_DID}#nope`)).toThrow();
  });

  it('issuer profile re-publishes the key list', () => {
    const k = generateKeyPair(new Uint8Array(32).fill(6));
    const profile = buildIssuerProfile({
      name: 'Redex Academy',
      keys: [{ id: 'k1', publicKeyMultibase: k.publicKeyMultibase, status: 'current' }],
    });
    expect(profile.type).toEqual(['Profile']);
    expect((profile.verificationMethod as unknown[]).length).toBe(1);
  });
});

describe('key rotation — old proofs still verify against the retired key', () => {
  it('verifies a pre-rotation credential after the issuer rotates keys', async () => {
    const k1 = generateKeyPair(new Uint8Array(32).fill(11));
    const vm1 = verificationMethodId(TEST_ISSUER_DID, 'k-2026-05');

    // Issue while k1 is current.
    const unsigned = buildAchievementCredential(TEST_BUILD_INPUT);
    const oldCred = await signCredential(unsigned, {
      privateKey: k1.privateKey,
      verificationMethod: vm1,
      created: TEST_CREATED,
    });

    // Rotate: k1 → retired, k2 → current. Both stay in the DID document.
    const k2 = generateKeyPair(new Uint8Array(32).fill(12));
    const rotatedDoc = buildDidDocument(
      [
        {
          id: 'k-2026-05',
          publicKeyMultibase: k1.publicKeyMultibase,
          status: 'retired',
          retiredAt: '2026-09-01T00:00:00Z',
        },
        { id: 'k-2026-09', publicKeyMultibase: k2.publicKeyMultibase, status: 'current' },
      ],
      TEST_ISSUER_DID,
    );

    // The OLD credential still verifies (resolves to the retired key in the doc).
    const oldResult = await verifyCredential(oldCred, { didDocument: rotatedDoc });
    expect(oldResult.verified).toBe(true);

    // A NEW credential signed by the current key verifies too.
    const newCred = await signCredential(unsigned, {
      privateKey: k2.privateKey,
      verificationMethod: verificationMethodId(TEST_ISSUER_DID, 'k-2026-09'),
      created: '2026-09-15T00:00:00Z',
    });
    const newResult = await verifyCredential(newCred, { didDocument: rotatedDoc });
    expect(newResult.verified).toBe(true);
  });
});
