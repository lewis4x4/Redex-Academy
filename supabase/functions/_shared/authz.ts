// ============================================================================
// supabase/functions/_shared/authz.ts  (Deno) — M6
//
// Evaluator authorization — the ACCESS-CONTROL BOUNDARY for finalize-signoff.
// finalize-signoff runs as the SERVICE ROLE (it must write competency_state +
// flip status to signed, which no end-user role may do), so it BYPASSES RLS.
// That makes the function itself the boundary: it MUST re-check the caller's
// authority here, never trusting the client.
//
// An evaluator may finalize a sign-off in a competency's domain ONLY IF
// (academy.evaluator_authorizations comment, wave4 §3.7):
//   * the caller holds the 'evaluator' role (JWT roles claim), AND
//   * a row in academy.evaluator_authorizations for (user_id, org_id) has
//     status = 'authorized' (not 'provisional'/'suspended'), AND
//   * is not expired (expires_at IS NULL OR expires_at > now), AND
//   * the competency/course domain ∈ that row's domains[].
// The JWT's evaluator_authorized/domains claims are a UI hint; the TABLE is
// authoritative (a claim can be stale — the function re-reads the live row).
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuthzInput {
  userId: string;
  orgId: string;
  /** The domain the sign-off's competency/course belongs to (e.g. 'AC'). */
  domain: string;
  /** roles[] from the verified JWT. */
  roles: readonly string[];
}

export type AuthzResult = { ok: true } | { ok: false; reason: string };

/**
 * Assert the caller is an authorized evaluator for `domain`. Reads the live
 * evaluator_authorizations row (service-role) — the authoritative source. Returns
 * a typed refusal (never throws) so the function can 403 with the reason.
 */
export async function assertEvaluatorAuthorized(
  // The full service-role client; we scope to the `academy` schema internally.
  // deno-lint-ignore no-explicit-any
  admin: SupabaseClient<any, any, any>,
  input: AuthzInput,
): Promise<AuthzResult> {
  if (!input.roles.includes('evaluator')) {
    return { ok: false, reason: 'not_evaluator' };
  }

  const { data, error } = await admin
    .schema('academy')
    .from('evaluator_authorizations')
    .select('status, domains, expires_at')
    .eq('user_id', input.userId)
    .eq('org_id', input.orgId);
  if (error) return { ok: false, reason: 'authz_read_error' };

  const now = Date.now();
  const authorized = (data ?? []).some((r) => {
    const row = r as { status: string; domains: string[] | null; expires_at: string | null };
    const live = row.expires_at === null || new Date(row.expires_at).getTime() > now;
    const inDomain = Array.isArray(row.domains) && row.domains.includes(input.domain);
    return row.status === 'authorized' && live && inDomain;
  });

  return authorized ? { ok: true } : { ok: false, reason: 'not_authorized_for_domain' };
}
