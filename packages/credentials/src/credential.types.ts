// ============================================================================
// packages/credentials/src/credential.types.ts
//
// Zod + TS for the OB 3.0 `AchievementCredential` (a W3C VC 2.0). Inputs are a
// trust boundary — always parsed. The on-the-wire credential uses VC 2.0 field
// names: `validFrom`/`validUntil` (NOT VC-1.1 `issuanceDate`/`expirationDate`,
// which the VC v2 @context does not define — using them would drop under
// jsonld safe mode). M7 reuses these types to issue the real slice badges.
// ============================================================================
import { z } from 'zod';

export const DataIntegrityProofSchema = z.object({
  type: z.literal('DataIntegrityProof'),
  cryptosuite: z.literal('eddsa-rdfc-2022'),
  created: z.string(),
  verificationMethod: z.string(),
  proofPurpose: z.literal('assertionMethod'),
  /** multibase base58btc ('z') of the raw 64-byte Ed25519 signature. */
  proofValue: z.string().regex(/^z/, 'proofValue must be multibase base58btc'),
});
export type DataIntegrityProof = z.infer<typeof DataIntegrityProofSchema>;

export const BitstringStatusEntrySchema = z.object({
  id: z.string(),
  type: z.literal('BitstringStatusListEntry'),
  statusPurpose: z.enum(['revocation', 'suspension']),
  statusListIndex: z.string(),
  statusListCredential: z.string(),
});
export type BitstringStatusEntry = z.infer<typeof BitstringStatusEntrySchema>;

export const AchievementSchema = z.object({
  id: z.string(),
  type: z.array(z.string()).default(['Achievement']),
  name: z.string(),
  description: z.string().optional(),
  criteria: z.object({ narrative: z.string().optional(), id: z.string().optional() }).optional(),
});
export type Achievement = z.infer<typeof AchievementSchema>;

export const CredentialSubjectSchema = z.object({
  id: z.string().optional(),
  type: z.array(z.string()).default(['AchievementSubject']),
  achievement: AchievementSchema,
});
export type CredentialSubject = z.infer<typeof CredentialSubjectSchema>;

export const IssuerSchema = z.object({
  id: z.string(),
  type: z.array(z.string()).default(['Profile']),
  name: z.string().optional(),
});
export type Issuer = z.infer<typeof IssuerSchema>;

export const EvidenceSchema = z.object({
  id: z.string().optional(),
  type: z.array(z.string()).default(['Evidence']),
  name: z.string().optional(),
  description: z.string().optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

/** The unsigned credential (no `proof`). */
export const UnsignedCredentialSchema = z.object({
  '@context': z.array(z.string()).min(1),
  id: z.string(),
  type: z.array(z.string()),
  issuer: IssuerSchema,
  validFrom: z.string(),
  validUntil: z.string().optional(),
  name: z.string().optional(),
  credentialSubject: CredentialSubjectSchema,
  credentialStatus: BitstringStatusEntrySchema.optional(),
  evidence: z.array(EvidenceSchema).optional(),
});
export type UnsignedCredential = z.infer<typeof UnsignedCredentialSchema>;

/** A signed, verifiable credential = unsigned + a Data Integrity proof. */
export const SignedCredentialSchema = UnsignedCredentialSchema.extend({
  proof: DataIntegrityProofSchema,
});
export type SignedCredential = z.infer<typeof SignedCredentialSchema>;

/** Input to the builder (server-controlled; still parsed at the boundary). */
export const BuildCredentialInputSchema = z.object({
  /** Public credential id (URL). */
  credentialId: z.string(),
  issuer: IssuerSchema,
  /** Recipient identifier (a DID, or e.g. a `urn:` / hashed-id reference). */
  recipientId: z.string().optional(),
  achievement: AchievementSchema,
  /** ISO 8601. */
  validFrom: z.string(),
  validUntil: z.string().optional(),
  name: z.string().optional(),
  credentialStatus: BitstringStatusEntrySchema.optional(),
  evidence: z.array(EvidenceSchema).optional(),
});
export type BuildCredentialInput = z.infer<typeof BuildCredentialInputSchema>;
