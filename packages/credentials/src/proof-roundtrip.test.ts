import { describe, it, expect } from 'vitest';
import { buildAchievementCredential } from './builder';
import { signCredential, verifyCredential, generateKeyPair } from './eddsa-rdfc-2022';
import {
  TEST_SEED,
  TEST_CREATED,
  TEST_VERIFICATION_METHOD,
  TEST_BUILD_INPUT,
  EXPECTED_PROOF_VALUE,
  EXPECTED_PUBLIC_KEY_MULTIBASE,
} from './test-vector';

const kp = generateKeyPair(TEST_SEED);
const unsigned = buildAchievementCredential(TEST_BUILD_INPUT);

async function sign() {
  return signCredential(unsigned, {
    privateKey: TEST_SEED,
    verificationMethod: TEST_VERIFICATION_METHOD,
    created: TEST_CREATED,
  });
}

describe('eddsa-rdfc-2022 proof', () => {
  it('reproduces the frozen test vector (Ed25519 is deterministic)', async () => {
    expect(kp.publicKeyMultibase).toBe(EXPECTED_PUBLIC_KEY_MULTIBASE);
    const signed = await sign();
    expect(signed.proof.cryptosuite).toBe('eddsa-rdfc-2022');
    expect(signed.proof.type).toBe('DataIntegrityProof');
    expect(signed.proof.proofPurpose).toBe('assertionMethod');
    expect(signed.proof.proofValue).toBe(EXPECTED_PROOF_VALUE);
  });

  it('verifies a freshly signed credential', async () => {
    const signed = await sign();
    const result = await verifyCredential(signed, { publicKey: kp.publicKey });
    expect(result.verified).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.verificationMethod).toBe(TEST_VERIFICATION_METHOD);
  });

  it('rejects a tampered claim', async () => {
    const signed = await sign();
    const tampered = structuredClone(signed);
    tampered.credentialSubject.achievement.name = 'Forged Achievement';
    const result = await verifyCredential(tampered, { publicKey: kp.publicKey });
    expect(result.verified).toBe(false);
  });

  it('rejects a tampered proofValue', async () => {
    const signed = await sign();
    const tampered = structuredClone(signed);
    // flip a character in the signature
    const pv = tampered.proof.proofValue;
    tampered.proof.proofValue = pv.slice(0, -1) + (pv.slice(-1) === 'a' ? 'b' : 'a');
    const result = await verifyCredential(tampered, { publicKey: kp.publicKey });
    expect(result.verified).toBe(false);
  });

  it('rejects verification under the wrong key', async () => {
    const signed = await sign();
    const other = generateKeyPair(new Uint8Array(32).fill(9));
    const result = await verifyCredential(signed, { publicKey: other.publicKey });
    expect(result.verified).toBe(false);
  });

  it('refuses to double-sign a document that already carries a proof', async () => {
    const signed = await sign();
    await expect(
      signCredential(signed as never, {
        privateKey: TEST_SEED,
        verificationMethod: TEST_VERIFICATION_METHOD,
        created: TEST_CREATED,
      }),
    ).rejects.toThrow(/already carries a proof/);
  });
});
