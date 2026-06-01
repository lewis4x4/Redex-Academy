import { Button, Card, EmptyState, ErrorState, ScreenHead, Skeleton, Tag, cx } from '@redex/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import {
  type CatalogGating,
  type CourseNode,
  type Tier,
  enrollSelf,
  loadCatalogGating,
} from './catalogSource';
import type { GatingState } from './gating';
import { useAppRoute } from '../navigation';

// Courses whose boss node opens a playable sim (mirrors Constellation).
const SIM_COURSES = new Set(['AC-203']);

// Tier display order (foundations → mastery). Any unknown tier sorts last.
const TIER_ORDER: Tier[] = ['foundations', 'core', 'advanced', 'mastery'];

// Per-state status dot (colorblind-safe: the spoken state label always accompanies
// it; hue is advisory). Token classes only — no raw hex (D1 invariant 9).
const STATE_DOT: Record<GatingState, string> = {
  locked: 'bg-ink-muted',
  available: 'bg-redex',
  in_progress: 'bg-redex-bright',
  passed: 'bg-state-pass',
  mastered: 'bg-gold',
};

/**
 * The Catalog — a plain, robust LIST view of the same published courses the
 * Constellation skill-map shows, grouped by tier. This exists as its OWN screen
 * (`?screen=catalog`) so the "Catalog" nav pill lands somewhere visibly distinct
 * from the Home constellation, and so the course list always renders even if the
 * SVG map is unavailable. It reuses the exact M1 data layer (`loadCatalogGating`)
 * and the same enroll / open-sim affordances as the map's detail card. Read-only
 * except self-enroll (RLS-permitted), identical to the Constellation.
 */
export function CatalogScreen() {
  const { t } = useTranslation();
  const { claims } = useAuth();
  const { navigate } = useAppRoute();

  const [data, setData] = useState<CatalogGating | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    loadCatalogGating()
      .then((d) => live && setData(d))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [nonce]);

  const stateLabel = useCallback((s: GatingState) => t(`catalog.state.${s}`), [t]);

  const onEnroll = useCallback(
    async (course: CourseNode) => {
      if (!claims?.sub || !claims.org_id) return;
      setEnrollingId(course.id);
      setEnrollError(null);
      try {
        await enrollSelf({ userId: claims.sub, orgId: claims.org_id, courseId: course.id });
        if (liveRef.current)
          liveRef.current.textContent = t('catalog.enrolled', { code: course.code });
        reload();
      } catch (e: unknown) {
        setEnrollError(e instanceof Error ? e.message : String(e));
      } finally {
        setEnrollingId(null);
      }
    },
    [claims, reload, t],
  );

  const head = (
    <div className="px-8 pt-2">
      <ScreenHead
        eyebrow={t('catalog.eyebrow')}
        title={t('catalog.title')}
        accent={t('catalog.title_accent')}
        subtitle={t('catalog.subtitle')}
      />
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-5 pb-10">
        {head}
        <div
          className="grid gap-4 px-8 sm:grid-cols-2 lg:grid-cols-3"
          role="status"
          aria-busy="true"
          aria-label={t('catalog.loading')}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={150} rounded="card" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-5 pb-10">
        {head}
        <div className="px-8">
          <ErrorState
            title={t('catalog.error_title')}
            description={error}
            onRetry={reload}
            retryLabel={t('catalog.retry')}
          />
        </div>
      </div>
    );
  }

  if (!data || data.courses.length === 0) {
    return (
      <div className="flex flex-col gap-5 pb-10">
        {head}
        <div className="px-8">
          <EmptyState title={t('catalog.empty_title')} description={t('catalog.empty_desc')} />
        </div>
      </div>
    );
  }

  // Group by tier, ordered foundations → mastery; courses within a tier by code.
  const byTier = new Map<Tier, CourseNode[]>();
  for (const c of data.courses) {
    const list = byTier.get(c.tier) ?? [];
    list.push(c);
    byTier.set(c.tier, list);
  }
  const tiers = [...byTier.keys()].sort((a, b) => {
    const ia = TIER_ORDER.indexOf(a);
    const ib = TIER_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  for (const list of byTier.values()) list.sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="flex flex-col gap-6 pb-10">
      {head}
      <p ref={liveRef} role="status" aria-live="polite" className="sr-only" />

      <div className="flex flex-col gap-8 px-8">
        {tiers.map((tier) => (
          <section
            key={tier}
            aria-label={t(`catalog.tier.${tier}`)}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center gap-3">
              <h2 className="text-eyebrow font-label uppercase tracking-eyebrow text-redex-bright">
                {t(`catalog.tier.${tier}`)}
              </h2>
              <span className="text-caption text-ink-muted">{(byTier.get(tier) ?? []).length}</span>
              <span className="h-px flex-1 bg-line" aria-hidden="true" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(byTier.get(tier) ?? []).map((c) => {
                const isSim =
                  SIM_COURSES.has(c.code) && c.state !== 'locked' && c.state !== 'available';
                return (
                  <Card
                    key={c.id}
                    variant="raised"
                    eyebrow={c.code}
                    title={c.title}
                    data-course={c.code}
                    data-state={c.state}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Tag>{c.domain}</Tag>
                        {c.isBoss ? <Tag variant="gate">{t('catalog.gate')}</Tag> : null}
                        <span className="ml-auto inline-flex items-center gap-1.5 text-caption text-ink-soft">
                          <span
                            className={cx('inline-block h-2 w-2 rounded-full', STATE_DOT[c.state])}
                            aria-hidden="true"
                          />
                          {stateLabel(c.state)}
                        </span>
                      </div>

                      {c.state === 'available' ? (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={enrollingId === c.id}
                          onClick={() => void onEnroll(c)}
                        >
                          {enrollingId === c.id ? t('catalog.enrolling') : t('catalog.enroll')}
                        </Button>
                      ) : c.state === 'locked' ? (
                        <p className="text-caption text-ink-muted">{t('catalog.locked_hint')}</p>
                      ) : (
                        <p className="text-caption text-ink-muted">
                          {t(`catalog.state_hint.${c.state}`)}
                        </p>
                      )}

                      {isSim ? (
                        <Button
                          variant="primary"
                          size="sm"
                          data-testid="open-sim"
                          onClick={() => navigate({ screen: 'sim', course: c.code })}
                        >
                          {t('catalog.open_sim')}
                        </Button>
                      ) : null}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}

        {enrollError ? (
          <p role="alert" className="px-8 text-caption text-state-fail">
            {enrollError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
