// ============================================================================
// packages/credentials/src/test-vector-data.ts
//
// RAW, ZERO-IMPORT vector data. This file imports NOTHING so it can be loaded
// BOTH by the Node package (via test-vector.ts, with types) AND directly by the
// Deno `issue-badge` Edge Function test (by explicit-.ts import — Deno needs a
// leaf module with no extensionless relative imports). See test-vector.ts for
// the rationale (Ed25519 determinism pins the two signers to one proofValue).
//
// The seed is a PUBLIC, throwaway TEST seed (all 0x07) — NOT a production key.
// ============================================================================

export const TEST_SEED_BYTES: number[] = new Array(32).fill(7);
export const TEST_ISSUER_DID = 'did:web:academy.redex.education';
export const TEST_KEY_ID = 'key-test-0';
export const TEST_VERIFICATION_METHOD = `${TEST_ISSUER_DID}#${TEST_KEY_ID}`;
export const TEST_CREATED = '2026-05-31T00:00:00Z';

export const TEST_BUILD_INPUT = {
  credentialId: 'https://academy.redex.education/credentials/f6-test-0001',
  issuer: { id: TEST_ISSUER_DID, type: ['Profile'], name: 'Redex Academy' },
  recipientId: 'did:example:f6-test-recipient',
  achievement: {
    id: 'https://academy.redex.education/achievements/skill.ac.maglock_rex_egress',
    type: ['Achievement'],
    name: 'Mag-lock REX Egress — Fail-Safe',
    description: 'Field-proven AC-203 mag-lock fail-safe egress competency (F6 issuer self-test).',
    criteria: { narrative: 'Demonstrated a server-authoritative AC-203 egress-fail sign-off.' },
  },
  validFrom: TEST_CREATED,
  credentialStatus: {
    id: 'https://academy.redex.education/status/1#7',
    type: 'BitstringStatusListEntry',
    statusPurpose: 'revocation',
    statusListIndex: '7',
    statusListCredential: 'https://academy.redex.education/status/1',
  },
  evidence: [
    {
      id: 'https://academy.redex.education/evidence/signoff/ac-203-demo',
      type: ['Evidence'],
      name: 'AC-203 sign-off evidence',
    },
  ],
} as const;

// Frozen expected outputs (recomputed by scripts/compute-test-vector.ts).
export const EXPECTED_PUBLIC_KEY_MULTIBASE = 'z6MkvDqGT54cXesYGvABpF1UapVNwjCqRcafi4Px6Thv5T3Z';
export const EXPECTED_PROOF_VALUE =
  'z32Roh3imCMh3taqqqwoxZYYAEktcjB85TbyhvU4hztcQMJs9CdR4sBQ6PQJnWW81fGvKycoauK6ax3DG83hEjdaX';
