import { z } from 'zod';

/** Personas drive UI/recommendations only — NEVER permissions (CODING_STANDARDS §7). */
export const PERSONAS = ['nova', 'marco', 'priya', 'dana'] as const;
export type Persona = (typeof PERSONAS)[number];

/** Role keys drive permissions/routes (mirrors academy.role_key). */
export const ROLE_KEYS = [
  'learner',
  'evaluator',
  'manager',
  'author',
  'curriculum_admin',
  'org_admin',
  'exec',
  'support',
] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

/**
 * The custom JWT claims minted by `academy.custom_access_token_hook` (F3) — the
 * exact top-level shape F2's RLS helpers read (`org_id`, `sub`, `roles`). Claims
 * are a TRUST BOUNDARY: always parse, never assume (CODING_STANDARDS.md §2).
 * `roles`/`domains` are arrays (a CSV/string would silently break jwt_has_role).
 */
export const academyClaimsSchema = z.object({
  sub: z.string().uuid().optional(),
  org_id: z.string().uuid().optional(),
  roles: z.array(z.string()).default([]),
  persona: z.enum(PERSONAS).optional(),
  evaluator_authorized: z.boolean().default(false),
  domains: z.array(z.string()).default([]),
});
export type AcademyClaims = z.infer<typeof academyClaimsSchema>;

/** Parse a claims object (e.g. a decoded JWT payload). Extra claims are ignored;
 *  a wrong shape (e.g. `roles` not an array) throws — a mis-shaped token is caught. */
export function parseClaims(input: unknown): AcademyClaims {
  return academyClaimsSchema.parse(input);
}

/** Non-throwing parse — returns null on a wrong shape. */
export function safeParseClaims(input: unknown): AcademyClaims | null {
  const result = academyClaimsSchema.safeParse(input);
  return result.success ? result.data : null;
}

/** True if the claims hold ANY of the given role keys (mirrors academy.jwt_has_role). */
export function hasRole(claims: Pick<AcademyClaims, 'roles'>, ...keys: RoleKey[]): boolean {
  const wanted: readonly string[] = keys;
  return claims.roles.some((role) => wanted.includes(role));
}

export type PersonaShell = 'field' | 'dense';

/** Persona → UI shell. Marco = field-first, low-literacy/dyslexia-friendly mobile;
 *  everyone else = dense. Drives UI ONLY (never permissions). */
export function personaShell(persona: Persona | undefined): PersonaShell {
  return persona === 'marco' ? 'field' : 'dense';
}

/**
 * Decode a Supabase access-token JWT's claims (base64url payload) WITHOUT verifying
 * the signature — a client-side READ for UI only. The server never trusts the
 * client; RLS verifies the signed token server-side. Returns null on malformed input.
 */
export function decodeJwtClaims(accessToken: string): AcademyClaims | null {
  const parts = accessToken.split('.');
  if (parts.length !== 3) return null;
  const segment = parts[1];
  if (!segment) return null;
  try {
    let b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    b64 += '='.repeat((4 - (b64.length % 4)) % 4);
    return safeParseClaims(JSON.parse(atob(b64)) as unknown);
  } catch {
    return null;
  }
}
