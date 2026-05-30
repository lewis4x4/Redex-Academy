import { type AcademyClaims, type RoleKey, hasRole } from '@redex/auth';
import type { ReactElement, ReactNode } from 'react';

export interface RoleGateProps {
  claims: AcademyClaims | null;
  /** Render children only if the claims hold ANY of these role keys. */
  anyOf: RoleKey[];
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Permission gate keyed on the `roles` claim (NEVER persona — CODING_STANDARDS §7).
 * Mirrors academy.jwt_has_role; the server's RLS is the real boundary, this only
 * hides UI the user can't act on.
 */
export function RoleGate({
  claims,
  anyOf,
  children,
  fallback = null,
}: RoleGateProps): ReactElement {
  const allowed = claims !== null && hasRole(claims, ...anyOf);
  return <>{allowed ? children : fallback}</>;
}
