// Compute the frozen test vector AND prove eddsa-rdfc-2022 conformance against
// the digitalbazaar reference suite (BOTH directions). Run: pnpm tsx scripts/compute-test-vector.ts
import jsigs from 'jsonld-signatures';
import { DataIntegrityProof } from '@digitalbazaar/data-integrity';
import * as eddsa from '@digitalbazaar/eddsa-rdfc-2022-cryptosuite';
import * as Ed25519Multikey from '@digitalbazaar/ed25519-multikey';

import { buildAchievementCredential } from '../src/builder';
import { signCredential, verifyCredential, generateKeyPair } from '../src/eddsa-rdfc-2022';
import { buildDidDocument } from '../src/did-web';
import { createDocumentLoader } from '../src/contexts/index';
import {
  TEST_SEED,
  TEST_CREATED,
  TEST_VERIFICATION_METHOD,
  TEST_ISSUER_DID,
  TEST_KEY_ID,
  TEST_BUILD_INPUT,
} from '../src/test-vector';

const eddsaRdfc2022CryptoSuite = (eddsa as { cryptosuite: unknown }).cryptosuite;

const kp = generateKeyPair(TEST_SEED);
const unsigned = buildAchievementCredential(TEST_BUILD_INPUT);

// ── mine signs ──
const mineSigned = await signCredential(unsigned, {
  privateKey: TEST_SEED,
  verificationMethod: TEST_VERIFICATION_METHOD,
  created: TEST_CREATED,
});

// ── mine verifies mine (roundtrip) ──
const mineVerifiesMine = await verifyCredential(mineSigned, { publicKey: kp.publicKey });

// loader serving contexts + the DID doc + the key doc (for the reference verifier)
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

const suite = new DataIntegrityProof({ cryptosuite: eddsaRdfc2022CryptoSuite });

// ── reference (digitalbazaar) verifies MINE ──
const refVerifiesMine = await jsigs.verify(structuredClone(mineSigned), {
  suite,
  purpose: new jsigs.purposes.AssertionProofPurpose(),
  documentLoader: loader,
});

// ── reference signs, MINE verifies ──
const refKey = await Ed25519Multikey.from({
  '@context': 'https://w3id.org/security/multikey/v1',
  id: TEST_VERIFICATION_METHOD,
  type: 'Multikey',
  controller: TEST_ISSUER_DID,
  publicKeyMultibase: kp.publicKeyMultibase,
  secretKeyMultibase: kp.secretKeyMultibase,
});
const signingSuite = new DataIntegrityProof({
  signer: refKey.signer(),
  date: new Date(TEST_CREATED),
  cryptosuite: eddsaRdfc2022CryptoSuite,
});
const refSigned = await jsigs.sign(structuredClone(unsigned), {
  suite: signingSuite,
  purpose: new jsigs.purposes.AssertionProofPurpose(),
  documentLoader: loader,
});
const mineVerifiesRef = await verifyCredential(refSigned as never, { publicKey: kp.publicKey });

console.log(
  JSON.stringify(
    {
      EXPECTED_PUBLIC_KEY_MULTIBASE: kp.publicKeyMultibase,
      EXPECTED_PROOF_VALUE: mineSigned.proof.proofValue,
      ref_proofValue: (refSigned as { proof: { proofValue: string } }).proof.proofValue,
      proofValues_byte_identical:
        mineSigned.proof.proofValue ===
        (refSigned as { proof: { proofValue: string } }).proof.proofValue,
      mine_verifies_mine: mineVerifiesMine.verified,
      reference_verifies_mine: refVerifiesMine.verified,
      mine_verifies_reference: mineVerifiesRef.verified,
      ref_errors: refVerifiesMine.error ? String(refVerifiesMine.error) : null,
    },
    null,
    2,
  ),
);
