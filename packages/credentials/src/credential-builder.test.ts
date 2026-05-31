import { describe, it, expect } from 'vitest';
import { buildAchievementCredential } from './builder';
import { UnsignedCredentialSchema, type BuildCredentialInput } from './credential.types';
import { CREDENTIAL_CONTEXT } from './issuer-config';
import { TEST_BUILD_INPUT } from './test-vector';

describe('buildAchievementCredential', () => {
  it('produces a VC-2.0-shaped OB 3.0 AchievementCredential', () => {
    const c = buildAchievementCredential(TEST_BUILD_INPUT);
    expect(c['@context']).toEqual([...CREDENTIAL_CONTEXT]);
    expect(c.type).toEqual(['VerifiableCredential', 'OpenBadgeCredential']);
    expect(c.issuer.id).toBe('did:web:redex.education');
    expect(c.credentialSubject.type).toEqual(['AchievementSubject']);
    expect(c.credentialSubject.achievement.name).toBe(TEST_BUILD_INPUT.achievement.name);
    // VC 2.0 uses validFrom (NOT issuanceDate, which the v2 @context drops).
    expect(c.validFrom).toBe(TEST_BUILD_INPUT.validFrom);
    expect('issuanceDate' in c).toBe(false);
    expect(c.credentialStatus?.type).toBe('BitstringStatusListEntry');
    expect(c.evidence?.[0]?.type).toEqual(['Evidence']);
  });

  it('omits optional fields when not provided', () => {
    const c = buildAchievementCredential({
      credentialId: 'https://redex.education/credentials/x',
      issuer: { id: 'did:web:redex.education', type: ['Profile'] },
      achievement: {
        id: 'https://redex.education/achievements/x',
        type: ['Achievement'],
        name: 'X',
      },
      validFrom: '2026-01-01T00:00:00Z',
    });
    expect('validUntil' in c).toBe(false);
    expect('credentialStatus' in c).toBe(false);
    expect('evidence' in c).toBe(false);
  });

  it('defaults evidence[].type to ["Evidence"] (parity with the Deno builder)', () => {
    const input = {
      credentialId: 'https://redex.education/credentials/y',
      issuer: { id: 'did:web:redex.education', type: ['Profile'] },
      achievement: {
        id: 'https://redex.education/achievements/y',
        type: ['Achievement'],
        name: 'Y',
      },
      validFrom: '2026-01-01T00:00:00Z',
      evidence: [{ id: 'https://redex.education/evidence/1' }], // no type
    } as unknown as BuildCredentialInput;
    const c = buildAchievementCredential(input);
    expect(c.evidence?.[0]?.type).toEqual(['Evidence']);
  });

  it('always emits a schema-valid unsigned credential', () => {
    const c = buildAchievementCredential(TEST_BUILD_INPUT);
    expect(() => UnsignedCredentialSchema.parse(c)).not.toThrow();
  });

  it('rejects malformed input at the boundary (Zod throws at runtime)', () => {
    // structurally invalid (no achievement) — cast past the compile-time type to
    // prove the RUNTIME boundary check rejects it.
    const bad = {
      credentialId: 'x',
      issuer: { id: 'did:web:x', type: ['Profile'] },
      validFrom: 'now',
    } as unknown as BuildCredentialInput;
    expect(() => buildAchievementCredential(bad)).toThrow();
  });
});
