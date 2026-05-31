// ============================================================================
// packages/credentials/src/test-vector.ts
//
// THE PARITY LINCHPIN (typed view). Ed25519 signatures are deterministic
// (RFC 8032): a fixed seed + fixed document + fixed `created` ⇒ a byte-identical
// proofValue. This frozen vector is asserted by BOTH the Node vitest suite AND
// the Deno `issue-badge` Edge Function test. If the two signers ever disagree —
// different concat order, multibase, canonicalization — one of those tests goes
// red. That is how the Edge Function reuses the leaf modules + duplicates only
// the ~30-line orchestration WITHOUT risking crypto drift.
//
// Raw values live in test-vector-data.ts (zero-import, so Deno can load it too).
// ============================================================================
import type { BuildCredentialInput } from './credential.types';
import {
  TEST_SEED_BYTES,
  TEST_BUILD_INPUT as RAW_BUILD_INPUT,
  TEST_ISSUER_DID,
  TEST_KEY_ID,
  TEST_VERIFICATION_METHOD,
  TEST_CREATED,
  EXPECTED_PROOF_VALUE,
  EXPECTED_PUBLIC_KEY_MULTIBASE,
} from './test-vector-data';

/** Public, deterministic 32-byte TEST seed (NOT a production key). */
export const TEST_SEED: Uint8Array = new Uint8Array(TEST_SEED_BYTES);
export const TEST_BUILD_INPUT: BuildCredentialInput =
  RAW_BUILD_INPUT as unknown as BuildCredentialInput;

export {
  TEST_ISSUER_DID,
  TEST_KEY_ID,
  TEST_VERIFICATION_METHOD,
  TEST_CREATED,
  EXPECTED_PROOF_VALUE,
  EXPECTED_PUBLIC_KEY_MULTIBASE,
};
