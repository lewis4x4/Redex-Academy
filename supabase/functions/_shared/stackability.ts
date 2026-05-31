// ============================================================================
// supabase/functions/_shared/stackability.ts  (Deno) — M7
//
// The PURE stackability resolver (ledger §D credential-as-prerequisite). Given
// the S1-seeded `academy.badge_classes` (`kind` + `requires`) it answers:
//   - which SKILL badge a just-`field_proven` competency earns, and
//   - whether a TIER credential's components are now all held → auto-issue.
//
// Pure + dependency-free (a leaf module, like multibase) so it runs identically
// under Deno (issue-badge) and is unit-testable via `deno test`. It DOES NOT
// invent the stack — it reads S1's `requires` shape (invariant 5). It performs NO
// issuance and touches NO key: the safety/credential gates (the candidate is
// really `field_proven`, the sign-off passed the veto) are enforced by the
// issue-badge orchestration around it (invariant 1).
// ============================================================================

/** A row from academy.badge_classes (only the fields the resolver needs). */
export interface BadgeClass {
  id: string;
  key: string;
  kind: 'skill' | 'tier' | 'role' | 'evaluator';
  title: string;
  requires: Record<string, unknown>;
  recert_months: number | null;
  is_compliance: boolean;
}

/** requires shape for a SKILL badge: {competency, signoff_required, courses, gating?}. */
export function skillRequiresCompetency(b: BadgeClass): string | null {
  const c = b.requires?.['competency'];
  return typeof c === 'string' ? c : null;
}

/** requires shape for a TIER credential: {badges:[skillKey...], auto_issue, competencies}. */
export function tierComponentBadgeKeys(b: BadgeClass): string[] {
  const v = b.requires?.['badges'];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function tierAutoIssueRule(b: BadgeClass): string | null {
  const v = b.requires?.['auto_issue'];
  return typeof v === 'string' ? v : null;
}

/**
 * The single SKILL badge a `field_proven` competency earns, or null if none in
 * the catalog maps to it. (At most one skill badge per competency in the slice.)
 */
export function resolveSkillBadgeForCompetency(
  badgeClasses: readonly BadgeClass[],
  competencyCode: string,
): BadgeClass | null {
  const matches = badgeClasses.filter(
    (b) => b.kind === 'skill' && skillRequiresCompetency(b) === competencyCode,
  );
  return matches[0] ?? null;
}

/** Tier credentials whose `requires.badges` includes the given skill badge key. */
export function tiersRequiringSkill(
  badgeClasses: readonly BadgeClass[],
  skillBadgeKey: string,
): BadgeClass[] {
  return badgeClasses.filter(
    (b) => b.kind === 'tier' && tierComponentBadgeKeys(b).includes(skillBadgeKey),
  );
}

/**
 * Should `tier` auto-issue, given the set of skill badge keys the candidate now
 * HOLDS? True ONLY when EVERY component badge is held AND the tier's rule is the
 * canonical `all_components_field_proven` (no tier without all its components —
 * the M7 red flag). Defensive: a tier with no components never auto-issues.
 */
export function shouldAutoIssueTier(tier: BadgeClass, heldSkillBadgeKeys: ReadonlySet<string>): boolean {
  if (tierAutoIssueRule(tier) !== 'all_components_field_proven') return false;
  const components = tierComponentBadgeKeys(tier);
  if (components.length === 0) return false;
  return components.every((key) => heldSkillBadgeKeys.has(key));
}

/** Convert badge_classes.recert_months → a credential validUntil ISO string. */
export function recertValidUntil(recertMonths: number | null, validFromIso: string): string | undefined {
  if (recertMonths == null || recertMonths <= 0) return undefined;
  const from = new Date(validFromIso);
  // Add whole months (UTC), clamping day overflow the way Date does naturally.
  const d = new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth() + recertMonths,
      from.getUTCDate(),
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
    ),
  );
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
