import { describe, expect, it } from 'vitest';
import { decodeJwtClaims, hasRole, parseClaims, personaShell, safeParseClaims } from './claims';

const b64url = (obj: unknown) =>
  btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fakeJwt = (claims: unknown) => `header.${b64url(claims)}.signature`;

const ORG = '00000000-0000-0000-0000-0000000000a1';
const SUB = '00000000-0000-0000-0000-0000000000c3';

describe('academy JWT claims', () => {
  it('parses the hook-minted shape (roles/domains arrays, persona, evaluator_authorized)', () => {
    const c = parseClaims({
      sub: SUB,
      org_id: ORG,
      roles: ['manager', 'evaluator'],
      persona: 'priya',
      evaluator_authorized: true,
      domains: ['AC', 'SEC'],
    });
    expect(c.org_id).toBe(ORG);
    expect(c.roles).toEqual(['manager', 'evaluator']);
    expect(c.persona).toBe('priya');
    expect(c.evaluator_authorized).toBe(true);
  });

  it('defaults roles/domains to [] and evaluator_authorized to false', () => {
    const c = parseClaims({ org_id: ORG });
    expect(c.roles).toEqual([]);
    expect(c.domains).toEqual([]);
    expect(c.evaluator_authorized).toBe(false);
  });

  it('REJECTS roles minted as a CSV/string (not an array) — guards the jwt_has_role contract', () => {
    expect(() => parseClaims({ org_id: ORG, roles: 'manager,evaluator' })).toThrow();
    expect(safeParseClaims({ roles: 'manager' })).toBeNull();
  });

  it('rejects an invalid persona / non-uuid org_id', () => {
    expect(safeParseClaims({ persona: 'wizard' })).toBeNull();
    expect(safeParseClaims({ org_id: 'not-a-uuid' })).toBeNull();
  });

  it('hasRole intersects like academy.jwt_has_role', () => {
    const c = parseClaims({ roles: ['manager', 'evaluator'] });
    expect(hasRole(c, 'manager')).toBe(true);
    expect(hasRole(c, 'exec', 'manager')).toBe(true);
    expect(hasRole(c, 'org_admin')).toBe(false);
  });

  it('personaShell: Marco = field-first, others = dense (UI only, not permissions)', () => {
    expect(personaShell('marco')).toBe('field');
    expect(personaShell('priya')).toBe('dense');
    expect(personaShell('dana')).toBe('dense');
    expect(personaShell(undefined)).toBe('dense');
  });

  it('decodeJwtClaims reads claims from a JWT payload (read-only, unverified)', () => {
    const token = fakeJwt({ sub: SUB, org_id: ORG, roles: ['learner'], persona: 'marco' });
    const c = decodeJwtClaims(token);
    expect(c?.org_id).toBe(ORG);
    expect(c?.roles).toEqual(['learner']);
    expect(personaShell(c?.persona)).toBe('field');
  });

  it('decodeJwtClaims returns null on malformed tokens', () => {
    expect(decodeJwtClaims('not-a-jwt')).toBeNull();
    expect(decodeJwtClaims('a.b')).toBeNull();
  });
});
