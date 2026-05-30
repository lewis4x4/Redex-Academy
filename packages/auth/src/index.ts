// @redex/auth — shared JWT custom-claim schema, parser, and role/persona helpers
// for the claims minted by academy.custom_access_token_hook (F3).
export {
  PERSONAS,
  ROLE_KEYS,
  academyClaimsSchema,
  parseClaims,
  safeParseClaims,
  hasRole,
  personaShell,
  decodeJwtClaims,
} from './claims';
export type { Persona, RoleKey, AcademyClaims, PersonaShell } from './claims';
