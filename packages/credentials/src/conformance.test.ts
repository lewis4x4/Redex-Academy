// Independent conformance: prove the signer is REAL eddsa-rdfc-2022 by testing
// it against the digitalbazaar reference suite — NOT against itself. Two
// directions plus byte-equality of the deterministic proofValue.
import { describe, it, expect } from 'vitest';
import jsigs from 'jsonld-signatures';
import { DataIntegrityProof } from '@digitalbazaar/data-integrity';
import * as eddsa from '@digitalbazaar/eddsa-rdfc-2022-cryptosuite';
import * as Ed25519Multikey from '@digitalbazaar/ed25519-multikey';

import { buildAchievementCredential } from './builder';
import { signCredential, verifyCredential, generateKeyPair } from './eddsa-rdfc-2022';
import { buildDidDocument } from './did-web';
import { createDocumentLoader } from './contexts/index';
import {
  TEST_SEED,
  TEST_CREATED,
  TEST_VERIFICATION_METHOD,
  TEST_ISSUER_DID,
  TEST_KEY_ID,
  TEST_BUILD_INPUT,
} from './test-vector';

const eddsaRdfc2022CryptoSuite = (eddsa as { cryptosuite: unknown }).cryptosuite;
const kp = generateKeyPair(TEST_SEED);
const unsigned = buildAchievementCredential(TEST_BUILD_INPUT);

const didDoc = buildDidDocument(
  [{ id: TEST_KEY_ID, publicKeyMultibase: kp.publicKeyMultibase, status: 'current' }],
  TEST_ISSUER_DID,
);
const keyDoc = {
  '@context': 'https://w3id.org/security/multikey/v1',
  id: TEST_VERIFICATION_METHOD,
  type: 'Multikey',
  controller: TEST_ISSUER_DID,
  publicKeyMultibase: kp.publicKeyMultibase,
};
const loader = createDocumentLoader({
  [TEST_ISSUER_DID]: didDoc,
  [TEST_VERIFICATION_METHOD]: keyDoc,
});
const verifySuite = new DataIntegrityProof({ cryptosuite: eddsaRdfc2022CryptoSuite });

describe('eddsa-rdfc-2022 conformance vs the digitalbazaar reference suite', () => {
  it('produces a byte-identical proofValue to the reference signer', async () => {
    const mine = await signCredential(unsigned, {
      privateKey: TEST_SEED,
      verificationMethod: TEST_VERIFICATION_METHOD,
      created: TEST_CREATED,
    });
    const refKey = await Ed25519Multikey.from({
      '@context': 'https://w3id.org/security/multikey/v1',
      id: TEST_VERIFICATION_METHOD,
      type: 'Multikey',
      controller: TEST_ISSUER_DID,
      publicKeyMultibase: kp.publicKeyMultibase,
      secretKeyMultibase: kp.secretKeyMultibase,
    });
    const refSigned = (await jsigs.sign(structuredClone(unsigned), {
      suite: new DataIntegrityProof({
        signer: refKey.signer(),
        date: new Date(TEST_CREATED),
        cryptosuite: eddsaRdfc2022CryptoSuite,
      }),
      purpose: new jsigs.purposes.AssertionProofPurpose(),
      documentLoader: loader,
    })) as { proof: { proofValue: string } };
    expect(mine.proof.proofValue).toBe(refSigned.proof.proofValue);
  });

  it('the reference verifier accepts a credential MY signer produced', async () => {
    const mine = await signCredential(unsigned, {
      privateKey: TEST_SEED,
      verificationMethod: TEST_VERIFICATION_METHOD,
      created: TEST_CREATED,
    });
    const result = await jsigs.verify(structuredClone(mine), {
      suite: verifySuite,
      purpose: new jsigs.purposes.AssertionProofPurpose(),
      documentLoader: loader,
    });
    expect(result.verified).toBe(true);
  });

  it('MY verifier accepts a credential the reference signer produced', async () => {
    const refKey = await Ed25519Multikey.from({
      '@context': 'https://w3id.org/security/multikey/v1',
      id: TEST_VERIFICATION_METHOD,
      type: 'Multikey',
      controller: TEST_ISSUER_DID,
      publicKeyMultibase: kp.publicKeyMultibase,
      secretKeyMultibase: kp.secretKeyMultibase,
    });
    const refSigned = await jsigs.sign(structuredClone(unsigned), {
      suite: new DataIntegrityProof({
        signer: refKey.signer(),
        date: new Date(TEST_CREATED),
        cryptosuite: eddsaRdfc2022CryptoSuite,
      }),
      purpose: new jsigs.purposes.AssertionProofPurpose(),
      documentLoader: loader,
    });
    const result = await verifyCredential(refSigned as never, { publicKey: kp.publicKey });
    expect(result.verified).toBe(true);
  });
});
