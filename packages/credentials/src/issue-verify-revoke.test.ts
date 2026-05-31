// e2e lifecycle (the F6_DRY_RUN §4 revocation signal, exercised in pure code so
// it runs in the `unit` CI job — the public-URL fetch is the delegated §J human
// gate): issue → verify → revoke (flip the status-list bit) → re-verify.
import { describe, it, expect } from 'vitest';
import { buildAchievementCredential } from './builder';
import { signCredential, verifyCredential, generateKeyPair, signJsonLd } from './eddsa-rdfc-2022';
import {
  createBitstring,
  setBit,
  encodeList,
  isRevoked,
  buildStatusListCredential,
  buildStatusEntry,
} from './status-list';
import { verifyJsonLd } from './eddsa-rdfc-2022';
import { TEST_SEED, TEST_VERIFICATION_METHOD, TEST_CREATED, TEST_BUILD_INPUT } from './test-vector';

const REVOKE_INDEX = 7;
const STATUS_URL = 'https://redex.education/status/1';

describe('issue → verify → revoke → re-verify', () => {
  it('flipping the status-list bit makes a still-signed credential read as revoked', async () => {
    const kp = generateKeyPair(TEST_SEED);
    const signOpts = {
      privateKey: TEST_SEED,
      verificationMethod: TEST_VERIFICATION_METHOD,
      created: TEST_CREATED,
    };

    // ── issue ──
    const unsigned = buildAchievementCredential({
      ...TEST_BUILD_INPUT,
      credentialStatus: buildStatusEntry({
        statusListCredentialUrl: STATUS_URL,
        index: REVOKE_INDEX,
      }),
    });
    const credential = await signCredential(unsigned, signOpts);

    // ── verify (active) ──
    const v1 = await verifyCredential(credential, { publicKey: kp.publicKey });
    expect(v1.verified).toBe(true);

    // status list with NOTHING revoked yet → usable
    const bits = createBitstring();
    let statusCred = await signJsonLd(
      buildStatusListCredential({
        id: STATUS_URL,
        issuer: { id: 'did:web:redex.education', type: ['Profile'] },
        encodedList: await encodeList(bits),
        validFrom: TEST_CREATED,
      }),
      signOpts,
    );
    const encoded1 = (statusCred.credentialSubject as { encodedList: string }).encodedList;
    expect(await isRevoked(encoded1, REVOKE_INDEX)).toBe(false);
    expect(v1.verified && !(await isRevoked(encoded1, REVOKE_INDEX))).toBe(true); // USABLE

    // ── revoke: flip the bit, re-publish (re-sign) the status list ──
    setBit(bits, REVOKE_INDEX, true);
    statusCred = await signJsonLd(
      buildStatusListCredential({
        id: STATUS_URL,
        issuer: { id: 'did:web:redex.education', type: ['Profile'] },
        encodedList: await encodeList(bits),
        validFrom: '2026-06-01T00:00:00Z',
      }),
      signOpts,
    );

    // the published status list itself must verify (verifiers trust it via its proof)
    expect((await verifyJsonLd(statusCred as never, { publicKey: kp.publicKey })).verified).toBe(
      true,
    );

    // ── re-verify (revoked) ──
    const v2 = await verifyCredential(credential, { publicKey: kp.publicKey });
    const encoded2 = (statusCred.credentialSubject as { encodedList: string }).encodedList;
    expect(v2.verified).toBe(true); // the SIGNATURE is still valid (revocation ≠ tamper)
    expect(await isRevoked(encoded2, REVOKE_INDEX)).toBe(true); // but the status bit is set
    expect(v2.verified && !(await isRevoked(encoded2, REVOKE_INDEX))).toBe(false); // NOT USABLE
  });
});
