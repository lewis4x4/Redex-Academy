// ============================================================================
// features/backpack/backpackSource.ts — the Digital Backpack data layer (M7).
//
// Reads the LEARNER'S OWN issued credentials (RLS scopes to the recipient — a
// learner has a SELECT policy on their own academy.credentials rows; they have NO
// write grant, invariant 3) and groups them into the stack: each TIER credential
// with its held component SKILL badges, plus any standalone skills. Pure grouping
// (groupIntoStack) is unit-tested; loadBackpack is the thin Supabase read.
// Signing/issuance is server-only (issue-badge) — the client only READS + links
// out to each badge's hosted verifiable URL.
// ============================================================================
import { supabase } from '../../auth/supabaseClient';

export type CredentialStatus = 'active' | 'expired' | 'revoked' | 'recert_required';
export type BadgeKind = 'skill' | 'tier' | 'role' | 'evaluator';

export interface BackpackCredential {
  id: string;
  badgeKey: string;
  badgeKind: BadgeKind;
  title: string;
  status: CredentialStatus;
  hostedAssertionUrl: string | null;
  expiresAt: string | null;
  evidenceUrls: string[];
  /** For tiers: the component skill badge keys (S1's requires.badges). */
  componentBadgeKeys: string[];
}

export interface BadgeStack {
  tier: BackpackCredential;
  /** The held component skill credentials for this tier (matched by requires.badges). */
  components: BackpackCredential[];
}

export interface GroupedBackpack {
  /** Held tier credentials, each with the held component skills under it. */
  stacks: BadgeStack[];
  /** Held skill credentials that are not a component of any held tier. */
  looseSkills: BackpackCredential[];
}

/** Group held credentials into the skill → tier stack. Pure + deterministic. */
export function groupIntoStack(credentials: readonly BackpackCredential[]): GroupedBackpack {
  const tiers = credentials.filter((c) => c.badgeKind === 'tier');
  const skills = credentials.filter((c) => c.badgeKind === 'skill');
  const claimedSkillKeys = new Set<string>();

  const stacks: BadgeStack[] = tiers.map((tier) => {
    const components = skills.filter((s) => tier.componentBadgeKeys.includes(s.badgeKey));
    for (const c of components) claimedSkillKeys.add(c.badgeKey);
    return { tier, components };
  });

  const looseSkills = skills.filter((s) => !claimedSkillKeys.has(s.badgeKey));
  return { stacks, looseSkills };
}

/** Is the credential currently usable (active + not past expiry)? Colorblind-safe
 *  presentation (text + symbol) is the view's job; this is the pure status read. */
export function isUsable(c: BackpackCredential, nowIso: string): boolean {
  if (c.status !== 'active') return false;
  if (c.expiresAt && c.expiresAt <= nowIso) return false;
  return true;
}

interface CredentialRow {
  id: string;
  status: CredentialStatus;
  hosted_assertion_url: string | null;
  expires_at: string | null;
  evidence_urls: string[] | null;
  badge_classes: {
    key: string;
    kind: BadgeKind;
    title: string;
    requires: { badges?: string[] } | null;
  } | null;
}

function toBackpackCredential(row: CredentialRow): BackpackCredential | null {
  const bc = row.badge_classes;
  if (!bc) return null;
  return {
    id: row.id,
    badgeKey: bc.key,
    badgeKind: bc.kind,
    title: bc.title,
    status: row.status,
    hostedAssertionUrl: row.hosted_assertion_url,
    expiresAt: row.expires_at,
    evidenceUrls: row.evidence_urls ?? [],
    componentBadgeKeys: Array.isArray(bc.requires?.badges) ? bc.requires!.badges! : [],
  };
}

/** Load the signed-in learner's issued credentials (RLS = own rows only). */
export async function loadBackpack(recipientUserId: string): Promise<BackpackCredential[]> {
  const { data, error } = await supabase
    .schema('academy')
    .from('credentials')
    .select(
      'id, status, hosted_assertion_url, expires_at, evidence_urls, badge_classes!inner(key, kind, title, requires)',
    )
    .eq('recipient_user_id', recipientUserId)
    .order('issued_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as CredentialRow[])
    .map(toBackpackCredential)
    .filter((c): c is BackpackCredential => c !== null);
}
