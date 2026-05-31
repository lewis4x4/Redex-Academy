// ============================================================================
// packages/credentials/src/builder.ts
//
// Construct the UNSIGNED OB 3.0 AchievementCredential (a W3C VC 2.0). Pure +
// deterministic: it takes every time-varying value (ids, dates) as input so
// the same input always yields the same bytes — which is what makes the signer
// testable against a fixed vector. Signing happens in eddsa-rdfc-2022.ts.
// ============================================================================
import { CREDENTIAL_CONTEXT } from './issuer-config';
import {
  BuildCredentialInputSchema,
  UnsignedCredentialSchema,
  type BuildCredentialInput,
  type UnsignedCredential,
} from './credential.types';

/**
 * Build an unsigned OB 3.0 `AchievementCredential`. The output's property
 * order is fixed but irrelevant to the proof — eddsa-rdfc-2022 canonicalizes to
 * RDF before hashing, so JSON key order never affects the signature.
 */
export function buildAchievementCredential(input: BuildCredentialInput): UnsignedCredential {
  const parsed = BuildCredentialInputSchema.parse(input);

  const credential: UnsignedCredential = {
    '@context': [...CREDENTIAL_CONTEXT],
    id: parsed.credentialId,
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    issuer: parsed.issuer,
    validFrom: parsed.validFrom,
    ...(parsed.validUntil ? { validUntil: parsed.validUntil } : {}),
    ...(parsed.name ? { name: parsed.name } : {}),
    credentialSubject: {
      ...(parsed.recipientId ? { id: parsed.recipientId } : {}),
      type: ['AchievementSubject'],
      achievement: {
        ...parsed.achievement,
        type: parsed.achievement.type ?? ['Achievement'],
      },
    },
    ...(parsed.credentialStatus ? { credentialStatus: parsed.credentialStatus } : {}),
    ...(parsed.evidence ? { evidence: parsed.evidence } : {}),
  };

  // Re-validate the assembled shape (defence in depth at the boundary).
  return UnsignedCredentialSchema.parse(credential);
}
