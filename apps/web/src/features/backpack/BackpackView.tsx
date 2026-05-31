// ============================================================================
// features/backpack/BackpackView.tsx — pure presentation for the Digital Backpack.
//
// Renders the skill → tier stack: each held TIER credential with its component
// SKILL badges, plus standalone skills. Every badge links out to its PUBLIC
// hosted verifiable URL (the credential verifies at a public URL — the M7 point).
// Status is colorblind-safe: a symbol glyph + text label, never colour alone
// (CLAUDE.md §8.4). Pure (props in, no data fetching) so it unit-tests cleanly.
// ============================================================================
import { Card, EmptyState, ScreenHead, Tag } from '@redex/ui';
import { useTranslation } from 'react-i18next';
import { type BackpackCredential, type GroupedBackpack, isUsable } from './backpackSource';

interface StatusPresentation {
  symbol: string;
  label: string;
}

function statusPresentation(
  c: BackpackCredential,
  nowIso: string,
  t: (key: string, def: string) => string,
): StatusPresentation {
  if (c.status === 'revoked')
    return { symbol: '⊘', label: t('backpack.status.revoked', 'Revoked') };
  if (c.status === 'recert_required')
    return { symbol: '⧖', label: t('backpack.status.recert', 'Recert required') };
  if (c.status === 'expired' || !isUsable(c, nowIso))
    return { symbol: '⧖', label: t('backpack.status.expired', 'Expired') };
  return { symbol: '✓', label: t('backpack.status.active', 'Active') };
}

function BadgeCard({
  credential,
  kindLabel,
  nowIso,
  t,
}: {
  credential: BackpackCredential;
  kindLabel: string;
  nowIso: string;
  t: (key: string, def: string) => string;
}): React.ReactElement {
  const status = statusPresentation(credential, nowIso, t);
  return (
    <Card title={credential.title} eyebrow={kindLabel} data-testid={`badge-${credential.badgeKey}`}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Colorblind-safe: symbol glyph + text, never colour alone. */}
        <Tag>
          <span aria-hidden="true">{status.symbol}</span> {status.label}
        </Tag>
        {credential.expiresAt ? (
          <span className="text-label text-ink-muted">
            {t('backpack.expires', 'Expires')} {credential.expiresAt.slice(0, 10)}
          </span>
        ) : null}
        {credential.hostedAssertionUrl ? (
          <a
            href={credential.hostedAssertionUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-label text-redex-bright underline"
            aria-label={
              t('backpack.verify_aria', 'Verify this credential at its public URL') +
              `: ${credential.title}`
            }
            data-testid={`verify-${credential.badgeKey}`}
          >
            {t('backpack.verify', 'Verify')} ↗
          </a>
        ) : (
          <span className="text-label text-ink-muted">
            {t('backpack.not_published', 'Not yet published')}
          </span>
        )}
      </div>
    </Card>
  );
}

export interface BackpackViewProps {
  grouped: GroupedBackpack;
  /** ISO timestamp used to compute expiry (passed in → deterministic + testable). */
  nowIso: string;
}

export function BackpackView({ grouped, nowIso }: BackpackViewProps): React.ReactElement {
  const { t } = useTranslation();
  const tt = (key: string, def: string) => t(key, def) as string;
  const isEmpty = grouped.stacks.length === 0 && grouped.looseSkills.length === 0;

  return (
    <section aria-labelledby="backpack-head">
      <ScreenHead
        eyebrow={tt('backpack.eyebrow', 'Credentials')}
        title={<span id="backpack-head">{tt('backpack.title', 'Digital Backpack')}</span>}
        subtitle={tt(
          'backpack.subtitle',
          'Your verifiable Open Badges — skill badges stack into tier credentials.',
        )}
      />

      {isEmpty ? (
        <EmptyState
          title={tt('backpack.empty.title', 'No badges yet')}
          description={tt(
            'backpack.empty.desc',
            'Pass an Evaluator field sign-off to earn your first skill badge.',
          )}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.stacks.map(({ tier, components }) => (
            <div
              key={tier.id}
              data-testid={`stack-${tier.badgeKey}`}
              className="flex flex-col gap-3"
            >
              <BadgeCard
                credential={tier}
                kindLabel={tt('backpack.kind.tier', 'Tier credential')}
                nowIso={nowIso}
                t={tt}
              />
              {components.length > 0 ? (
                <ul
                  className="flex flex-col gap-2 pl-4"
                  aria-label={tt('backpack.components', 'Component skill badges')}
                >
                  {components.map((skill) => (
                    <li key={skill.id}>
                      <BadgeCard
                        credential={skill}
                        kindLabel={tt('backpack.kind.skill', 'Skill badge')}
                        nowIso={nowIso}
                        t={tt}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}

          {grouped.looseSkills.length > 0 ? (
            <ul className="flex flex-col gap-2" aria-label={tt('backpack.skills', 'Skill badges')}>
              {grouped.looseSkills.map((skill) => (
                <li key={skill.id}>
                  <BadgeCard
                    credential={skill}
                    kindLabel={tt('backpack.kind.skill', 'Skill badge')}
                    nowIso={nowIso}
                    t={tt}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
