import { describe, it, expect } from 'vitest';
import { groupIntoStack, isUsable, type BackpackCredential } from './backpackSource';

const cred = (over: Partial<BackpackCredential>): BackpackCredential => ({
  id: 'id',
  badgeKey: 'k',
  badgeKind: 'skill',
  title: 'T',
  status: 'active',
  hostedAssertionUrl: 'https://academy.redex.education/credentials/x',
  expiresAt: null,
  evidenceUrls: [],
  componentBadgeKeys: [],
  ...over,
});

describe('groupIntoStack', () => {
  it('nests held component skills under their tier and lists standalone skills separately', () => {
    const tier = cred({
      id: 't',
      badgeKey: 'tier.ac.certified_technician',
      badgeKind: 'tier',
      title: 'Certified Technician — Access Control',
      componentBadgeKeys: ['skill.ac.single_door_aero', 'skill.ac.maglock_rex_egress'],
    });
    const aero = cred({ id: 's1', badgeKey: 'skill.ac.single_door_aero', title: 'Aero' });
    const maglock = cred({ id: 's2', badgeKey: 'skill.ac.maglock_rex_egress', title: 'Maglock' });
    const loose = cred({ id: 's3', badgeKey: 'skill.ac.something_else', title: 'Other' });

    const grouped = groupIntoStack([tier, aero, maglock, loose]);
    expect(grouped.stacks).toHaveLength(1);
    expect(grouped.stacks[0]!.tier.badgeKey).toBe('tier.ac.certified_technician');
    expect(grouped.stacks[0]!.components.map((c) => c.badgeKey).sort()).toEqual([
      'skill.ac.maglock_rex_egress',
      'skill.ac.single_door_aero',
    ]);
    expect(grouped.looseSkills.map((c) => c.badgeKey)).toEqual(['skill.ac.something_else']);
  });

  it('with no tier, all skills are loose', () => {
    const grouped = groupIntoStack([
      cred({ id: 's1', badgeKey: 'skill.a' }),
      cred({ id: 's2', badgeKey: 'skill.b' }),
    ]);
    expect(grouped.stacks).toHaveLength(0);
    expect(grouped.looseSkills).toHaveLength(2);
  });
});

describe('isUsable', () => {
  const now = '2026-06-01T00:00:00Z';
  it('active + no/future expiry is usable; revoked/expired/past-expiry is not', () => {
    expect(isUsable(cred({ status: 'active', expiresAt: null }), now)).toBe(true);
    expect(isUsable(cred({ status: 'active', expiresAt: '2027-01-01T00:00:00Z' }), now)).toBe(true);
    expect(isUsable(cred({ status: 'active', expiresAt: '2026-01-01T00:00:00Z' }), now)).toBe(
      false,
    );
    expect(isUsable(cred({ status: 'revoked' }), now)).toBe(false);
    expect(isUsable(cred({ status: 'recert_required' }), now)).toBe(false);
  });
});
