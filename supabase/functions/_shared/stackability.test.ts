// ============================================================================
// _shared/stackability.test.ts (Deno) — M7 stackability resolver unit tests.
// Run by the deno-check CI job. Pure logic — no DB, no key.
// ============================================================================
import { assert, assertEquals, assertFalse } from '@std/assert';
import {
  resolveSkillBadgeForCompetency,
  tiersRequiringSkill,
  shouldAutoIssueTier,
  recertValidUntil,
  type BadgeClass,
} from './stackability.ts';

// Fixtures mirroring the S1-seeded slice badge_classes.
const SKILL_AERO: BadgeClass = { id: 's1', key: 'skill.ac.single_door_aero', kind: 'skill', title: 'Aero', requires: { competency: 'AC.AERO_SINGLE_DOOR', signoff_required: true }, recert_months: 24, is_compliance: false };
const SKILL_MERCURY: BadgeClass = { id: 's2', key: 'skill.ac.mercury_wiring', kind: 'skill', title: 'Mercury', requires: { competency: 'AC.MERCURY_WIRING' }, recert_months: 24, is_compliance: false };
const SKILL_MAGLOCK: BadgeClass = { id: 's3', key: 'skill.ac.maglock_rex_egress', kind: 'skill', title: 'Maglock', requires: { competency: 'EGRESS.MAGLOCK_FAILSAFE', gating: true }, recert_months: 12, is_compliance: true };
const TIER: BadgeClass = { id: 't1', key: 'tier.ac.certified_technician', kind: 'tier', title: 'Certified Technician — Access Control', requires: { badges: ['skill.ac.single_door_aero', 'skill.ac.mercury_wiring', 'skill.ac.maglock_rex_egress'], auto_issue: 'all_components_field_proven' }, recert_months: 12, is_compliance: true };
const CATALOG = [SKILL_AERO, SKILL_MERCURY, SKILL_MAGLOCK, TIER];

Deno.test('resolveSkillBadgeForCompetency maps a competency code to its skill badge', () => {
  assertEquals(resolveSkillBadgeForCompetency(CATALOG, 'EGRESS.MAGLOCK_FAILSAFE')?.key, 'skill.ac.maglock_rex_egress');
  assertEquals(resolveSkillBadgeForCompetency(CATALOG, 'AC.AERO_SINGLE_DOOR')?.key, 'skill.ac.single_door_aero');
  assertEquals(resolveSkillBadgeForCompetency(CATALOG, 'NOPE.UNKNOWN'), null);
});

Deno.test('tiersRequiringSkill finds tiers that stack on a skill', () => {
  assertEquals(tiersRequiringSkill(CATALOG, 'skill.ac.maglock_rex_egress').map((t) => t.key), ['tier.ac.certified_technician']);
  assertEquals(tiersRequiringSkill(CATALOG, 'skill.ac.nonexistent'), []);
});

Deno.test('shouldAutoIssueTier requires ALL components (no tier without its components)', () => {
  const all = new Set(['skill.ac.single_door_aero', 'skill.ac.mercury_wiring', 'skill.ac.maglock_rex_egress']);
  assert(shouldAutoIssueTier(TIER, all));
  // missing one component → no auto-issue (the M7 red flag guard)
  assertFalse(shouldAutoIssueTier(TIER, new Set(['skill.ac.single_door_aero', 'skill.ac.maglock_rex_egress'])));
  assertFalse(shouldAutoIssueTier(TIER, new Set()));
  // wrong auto_issue rule → never auto-issues
  const noRule: BadgeClass = { ...TIER, requires: { badges: [...(TIER.requires.badges as string[])] } };
  assertFalse(shouldAutoIssueTier(noRule, all));
  // a tier with no components never auto-issues
  const empty: BadgeClass = { ...TIER, requires: { badges: [], auto_issue: 'all_components_field_proven' } };
  assertFalse(shouldAutoIssueTier(empty, all));
});

Deno.test('recertValidUntil adds whole months (12-mo egress) and handles null', () => {
  assertEquals(recertValidUntil(12, '2026-05-31T00:00:00Z'), '2027-05-31T00:00:00Z');
  assertEquals(recertValidUntil(24, '2026-01-15T00:00:00Z'), '2028-01-15T00:00:00Z');
  assertEquals(recertValidUntil(null, '2026-05-31T00:00:00Z'), undefined);
  assertEquals(recertValidUntil(0, '2026-05-31T00:00:00Z'), undefined);
});
