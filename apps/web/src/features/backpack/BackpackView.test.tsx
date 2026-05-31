import { initI18n } from '@redex/i18n';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { BackpackView } from './BackpackView';
import { groupIntoStack, type BackpackCredential } from './backpackSource';

const NOW = '2026-06-01T00:00:00Z';

const cred = (over: Partial<BackpackCredential>): BackpackCredential => ({
  id: 'id',
  badgeKey: 'k',
  badgeKind: 'skill',
  title: 'T',
  status: 'active',
  hostedAssertionUrl: 'https://redex.education/credentials/x',
  expiresAt: null,
  evidenceUrls: [],
  componentBadgeKeys: [],
  ...over,
});

beforeEach(() => {
  initI18n();
});

describe('BackpackView', () => {
  it('renders the skill → tier stack with public verify links and 12-mo expiry', () => {
    const tier = cred({
      id: 't',
      badgeKey: 'tier.ac.certified_technician',
      badgeKind: 'tier',
      title: 'Certified Technician — Access Control',
      hostedAssertionUrl: 'https://redex.education/credentials/tier-1',
      expiresAt: '2027-05-31T00:00:00Z',
      componentBadgeKeys: ['skill.ac.maglock_rex_egress'],
    });
    const maglock = cred({
      id: 's1',
      badgeKey: 'skill.ac.maglock_rex_egress',
      title: 'Mag Lock + REX + Egress Wiring',
      hostedAssertionUrl: 'https://redex.education/credentials/skill-1',
      expiresAt: '2027-05-31T00:00:00Z',
    });

    render(<BackpackView grouped={groupIntoStack([tier, maglock])} nowIso={NOW} />);

    expect(screen.getByText('Certified Technician — Access Control')).toBeInTheDocument();
    expect(screen.getByText('Mag Lock + REX + Egress Wiring')).toBeInTheDocument();

    // each badge links out to its PUBLIC hosted verifiable URL
    const tierVerify = screen.getByTestId('verify-tier.ac.certified_technician');
    expect(tierVerify).toHaveAttribute('href', 'https://redex.education/credentials/tier-1');
    const skillVerify = screen.getByTestId('verify-skill.ac.maglock_rex_egress');
    expect(skillVerify).toHaveAttribute('href', 'https://redex.education/credentials/skill-1');

    // colorblind-safe status carries TEXT (not colour alone)
    expect(
      within(screen.getByTestId('badge-tier.ac.certified_technician')).getByText('Active'),
    ).toBeInTheDocument();
    // 12-mo recert/expiry surfaced
    expect(screen.getAllByText(/Expires 2027-05-31/).length).toBeGreaterThan(0);
  });

  it('shows revoked + expired status as TEXT (colorblind-safe), not colour alone', () => {
    const revoked = cred({
      id: 'r',
      badgeKey: 'skill.revoked',
      title: 'Revoked Skill',
      status: 'revoked',
    });
    const expired = cred({
      id: 'e',
      badgeKey: 'skill.expired',
      title: 'Expired Skill',
      status: 'active',
      expiresAt: '2026-01-01T00:00:00Z', // before NOW
    });
    render(<BackpackView grouped={groupIntoStack([revoked, expired])} nowIso={NOW} />);
    expect(
      within(screen.getByTestId('badge-skill.revoked')).getByText('Revoked'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('badge-skill.expired')).getByText('Expired'),
    ).toBeInTheDocument();
  });

  it('renders an empty state when the learner has no badges', () => {
    render(<BackpackView grouped={groupIntoStack([])} nowIso={NOW} />);
    expect(screen.getByText('No badges yet')).toBeInTheDocument();
  });
});
