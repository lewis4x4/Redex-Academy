// ============================================================================
// supabase/functions/issue-badge/handler.test.ts  (Deno) — F6
//
// Proves the DENO signer is byte-for-byte identical to the Node @redex/credentials
// signer (the frozen test vector) and exercises the issuer's authorization
// boundary + self-verify. Run by the deno-check CI job. The vector is the parity
// guarantee that lets the Edge Function reuse the package's leaf modules and
// duplicate only the thin orchestration without crypto drift.
// ============================================================================
import { assert, assertEquals, assertFalse } from '@std/assert';
import {
  buildUnsignedCredential,
  signCredential,
  verifyCredential,
  loadSigningKey,
  type AchievementInput,
} from '../_shared/credential-signer.ts';
import { isAuthorizedIssuer, readClaims, buildAndSignCredential, bodySchema } from './handler.ts';
import { resolveIssuerEndpoints } from '../../../packages/credentials/src/issuer-config.ts';
import {
  TEST_SEED_BYTES,
  TEST_BUILD_INPUT,
  TEST_VERIFICATION_METHOD,
  TEST_ISSUER_DID,
  TEST_KEY_ID,
  TEST_CREATED,
  EXPECTED_PROOF_VALUE,
  EXPECTED_PUBLIC_KEY_MULTIBASE,
} from '../../../packages/credentials/src/test-vector-data.ts';
import {
  ed25519SecretKeyMultibase,
  ed25519PublicKeyMultibase,
} from '../../../packages/credentials/src/multibase.ts';
import * as ed from '@noble/ed25519';

const TEST_SEED = new Uint8Array(TEST_SEED_BYTES);
const BUILD_INPUT = TEST_BUILD_INPUT as unknown as AchievementInput;

Deno.test('Deno signer reproduces the frozen test vector (parity with the Node signer)', async () => {
  // public key multibase matches
  assertEquals(ed25519PublicKeyMultibase(ed.getPublicKey(TEST_SEED)), EXPECTED_PUBLIC_KEY_MULTIBASE);

  const unsigned = buildUnsignedCredential(BUILD_INPUT);
  const signed = (await signCredential(unsigned, {
    privateKey: TEST_SEED,
    verificationMethod: TEST_VERIFICATION_METHOD,
    created: TEST_CREATED,
  })) as { proof: { proofValue: string; cryptosuite: string } };

  assertEquals(signed.proof.cryptosuite, 'eddsa-rdfc-2022');
  // THE parity assertion — byte-identical to the Node @redex/credentials output.
  assertEquals(signed.proof.proofValue, EXPECTED_PROOF_VALUE);
});

Deno.test('Deno verifier accepts a fresh signature and rejects tampering', async () => {
  const pub = ed.getPublicKey(TEST_SEED);
  const unsigned = buildUnsignedCredential(BUILD_INPUT);
  const signed = await signCredential(unsigned, {
    privateKey: TEST_SEED,
    verificationMethod: TEST_VERIFICATION_METHOD,
    created: TEST_CREATED,
  });
  assert(await verifyCredential(signed, pub));

  const tampered = JSON.parse(JSON.stringify(signed)) as Record<string, unknown>;
  (tampered.credentialSubject as { achievement: { name: string } }).achievement.name = 'Forged';
  assertFalse(await verifyCredential(tampered, pub));
});

Deno.test('buildAndSignCredential self-verifies and embeds a revocation status entry', async () => {
  const secretKeyMultibase = ed25519SecretKeyMultibase(TEST_SEED);
  const { credential } = await buildAndSignCredential({
    spec: {
      recipientId: 'did:example:recipient',
      achievement: { id: 'https://academy.redex.education/achievements/x', type: ['Achievement'], name: 'X' },
      evidenceUrls: ['https://academy.redex.education/evidence/so-1/ev-1'],
    },
    issuer: { did: TEST_ISSUER_DID, keyId: TEST_KEY_ID, secretKeyMultibase },
    credentialId: 'https://academy.redex.education/credentials/abc',
    statusListIndex: 42,
    created: TEST_CREATED,
    endpoints: resolveIssuerEndpoints(TEST_ISSUER_DID),
  });
  const status = (credential as { credentialStatus: { statusListIndex: string; type: string } })
    .credentialStatus;
  assertEquals(status.type, 'BitstringStatusListEntry');
  assertEquals(status.statusListIndex, '42');
  assertEquals((credential as { evidence: { id: string }[] }).evidence[0]!.id, 'https://academy.redex.education/evidence/so-1/ev-1');

  const { publicKey } = loadSigningKey(secretKeyMultibase);
  assert(await verifyCredential(credential, publicKey));
});

Deno.test('Deno builder defaults evidence[].type to ["Evidence"] (parity with the Node builder)', () => {
  const c = buildUnsignedCredential({
    credentialId: 'https://academy.redex.education/credentials/z',
    issuer: { id: TEST_ISSUER_DID },
    achievement: { id: 'https://academy.redex.education/achievements/z', name: 'Z' },
    validFrom: TEST_CREATED,
    evidence: [{ id: 'https://academy.redex.education/evidence/2' }], // no type
  });
  const ev = (c as { evidence: Array<{ type: string[] }> }).evidence;
  assertEquals(ev[0]!.type, ['Evidence']);
});

Deno.test('issuance is gated to issuer roles — a learner can never mint a badge', () => {
  assertFalse(isAuthorizedIssuer(['learner']));
  assertFalse(isAuthorizedIssuer(['evaluator']));
  assertFalse(isAuthorizedIssuer([]));
  assert(isAuthorizedIssuer(['org_admin']));
  assert(isAuthorizedIssuer(['support', 'learner']));
});

Deno.test('readClaims parses roles/org_id from a JWT payload', () => {
  const payload = { sub: 'u1', org_id: 'o1', roles: ['org_admin'] };
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const claims = readClaims(`x.${b64}.y`);
  assertEquals(claims.org_id, 'o1');
  assertEquals(claims.roles, ['org_admin']);
});

Deno.test('bodySchema requires a valid action and rejects malformed payloads', () => {
  assertFalse(bodySchema.safeParse({ recipient_user_id: 'not-a-uuid' }).success); // no action
  assertFalse(bodySchema.safeParse({ action: 'rollup', candidate_user_id: 'x' }).success); // bad uuid
  assert(
    bodySchema.safeParse({
      action: 'issue-test',
      recipient_user_id: '00000000-0000-0000-0000-000000000001',
      badge_class_id: '00000000-0000-0000-0000-000000000002',
      achievement: { id: 'https://x/a', name: 'A' },
    }).success,
  );
  assert(
    bodySchema.safeParse({
      action: 'rollup',
      candidate_user_id: '00000000-0000-0000-0000-000000000001',
      competency_id: '00000000-0000-0000-0000-000000000002',
      signoff_id: '00000000-0000-0000-0000-000000000003',
    }).success,
  );
});
