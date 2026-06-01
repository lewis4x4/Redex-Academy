import {
  Button,
  Card,
  ErrorState,
  ProgressBar,
  ScreenHead,
  Skeleton,
  StatBlock,
  StatusBadge,
  Tag,
  cx,
} from '@redex/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { supabase } from '../auth/supabaseClient';
import {
  type CatalogGating,
  type CourseNode,
  type Persona,
  type Tier,
  enrollSelf,
  loadCatalogGating,
} from '../catalog/catalogSource';
import type { GatingState } from '../catalog/gating';
import { useAppRoute } from '../navigation';

// Courses whose boss node opens a playable sim (mirrors Catalog/Constellation).
const SIM_COURSES = new Set(['AC-203']);
const TIER_ORDER: Tier[] = ['foundations', 'core', 'advanced', 'mastery'];

const STATE_DOT: Record<GatingState, string> = {
  locked: 'bg-ink-muted',
  available: 'bg-redex',
  in_progress: 'bg-redex-bright',
  passed: 'bg-state-pass',
  mastered: 'bg-gold',
};

function tierRank(tier: Tier): number {
  const i = TIER_ORDER.indexOf(tier);
  return i === -1 ? 99 : i;
}

/**
 * The learner Home — a personalized welcome dashboard (the default landing screen).
 * Orients a returning learner in one glance: who they are, where they stand
 * (progress stats), what to pick back up (Continue), what to do next (Recommended),
 * and the ways to explore (skill-map, catalog, backpack). The constellation is no
 * longer the home — it lives one click away as its own sub-page. All facts come
 * from the same RLS-scoped M1 catalog read (`loadCatalogGating`); the credential
 * count is a best-effort enhancement that degrades silently.
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const { session, claims } = useAuth();
  const { navigate } = useAppRoute();
  const persona = claims?.persona as Persona | undefined;

  // Best-effort display name: OAuth metadata → email local-part → friendly fallback.
  const meta = (session?.user.user_metadata ?? {}) as Record<string, unknown>;
  const rawName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    (typeof meta.first_name === 'string' && meta.first_name) ||
    (session?.user.email ? session.user.email.split('@')[0] : '') ||
    t('home.fallback_name');
  const firstToken =
    String(rawName)
      .trim()
      .split(/[\s.]+/)[0] || String(rawName);
  const name = firstToken.charAt(0).toUpperCase() + firstToken.slice(1);

  const [data, setData] = useState<CatalogGating | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [credentialCount, setCredentialCount] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const [startingId, setStartingId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
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

  // Best-effort active-credential count (RLS-scoped). Non-fatal: errors leave it hidden.
  useEffect(() => {
    let live = true;
    void supabase
      .schema('academy')
      .from('credentials')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .then(({ count, error: e }) => {
        if (live && !e && typeof count === 'number') setCredentialCount(count);
      });
    return () => {
      live = false;
    };
  }, [nonce]);

  const buckets = useMemo(() => {
    const courses = data?.courses ?? [];
    const inProgress = courses.filter((c) => c.state === 'in_progress');
    const completed = courses.filter((c) => c.state === 'passed' || c.state === 'mastered');
    const available = courses.filter((c) => c.state === 'available');
    const byProgression = (a: CourseNode, b: CourseNode) =>
      tierRank(a.tier) - tierRank(b.tier) || a.code.localeCompare(b.code);
    // Continue: prefer a sim-bearing course (it has a concrete in-app destination).
    const resume =
      [...inProgress].sort(
        (a, b) =>
          Number(SIM_COURSES.has(b.code)) - Number(SIM_COURSES.has(a.code)) || byProgression(a, b),
      )[0] ?? null;
    // Recommend: the earliest available course, preferring a persona-matched one.
    const recommended =
      [...available].sort(
        (a, b) =>
          Number(persona ? b.personas.includes(persona) : false) -
            Number(persona ? a.personas.includes(persona) : false) || byProgression(a, b),
      )[0] ?? null;
    return { inProgress, completed, available, resume, recommended, total: courses.length };
  }, [data, persona]);

  const stateLabel = useCallback((s: GatingState) => t(`catalog.state.${s}`), [t]);

  // "Open this course": a sim course → its sim; otherwise the map, where the
  // unit/lesson affordances live.
  const openCourse = useCallback(
    (course: CourseNode) => {
      if (SIM_COURSES.has(course.code)) {
        navigate({ screen: 'sim', course: course.code, unit: null });
      } else {
        navigate({ screen: 'constellation', course: null, unit: null });
      }
    },
    [navigate],
  );

  const onStart = useCallback(
    async (course: CourseNode) => {
      if (!claims?.sub || !claims.org_id) {
        navigate({ screen: 'constellation', course: null, unit: null });
        return;
      }
      setStartingId(course.id);
      setStartError(null);
      try {
        await enrollSelf({ userId: claims.sub, orgId: claims.org_id, courseId: course.id });
        if (liveRef.current)
          liveRef.current.textContent = t('catalog.enrolled', { code: course.code });
        openCourse(course);
      } catch (e: unknown) {
        setStartError(e instanceof Error ? e.message : String(e));
      } finally {
        setStartingId(null);
      }
    },
    [claims, navigate, openCourse, t],
  );

  const started = buckets.completed.length + buckets.inProgress.length > 0;
  const head = (
    <div className="px-8 pt-2">
      <ScreenHead
        eyebrow={t('home.eyebrow')}
        title={data && started ? t('home.greeting', { name }) : t('home.greeting_new', { name })}
        subtitle={t('home.subtitle')}
      />
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-6 pb-10">
        {head}
        <div className="grid gap-4 px-8 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={92} rounded="card" />
          ))}
        </div>
        <div className="grid gap-4 px-8 lg:grid-cols-2">
          <Skeleton height={150} rounded="card" />
          <Skeleton height={150} rounded="card" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 pb-10">
        {head}
        <div className="px-8">
          <ErrorState
            title={t('home.error_title')}
            description={error}
            onRetry={reload}
            retryLabel={t('catalog.retry')}
          />
        </div>
      </div>
    );
  }

  const pct = buckets.total > 0 ? Math.round((buckets.completed.length / buckets.total) * 100) : 0;

  const CourseCta = ({ course, kind }: { course: CourseNode; kind: 'resume' | 'start' }) => (
    <Card variant="raised" eyebrow={course.code} title={course.title}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tag variant="tier">{t(`catalog.tier.${course.tier}`)}</Tag>
          <Tag>{course.domain}</Tag>
          {course.isBoss ? <Tag variant="gate">{t('catalog.gate')}</Tag> : null}
          <span className="ml-auto inline-flex items-center gap-1.5 text-caption text-ink-soft">
            <span
              className={cx('inline-block h-2 w-2 rounded-full', STATE_DOT[course.state])}
              aria-hidden="true"
            />
            {stateLabel(course.state)}
          </span>
        </div>
        {kind === 'resume' ? (
          <Button variant="primary" size="sm" onClick={() => openCourse(course)}>
            {t('home.continue.resume', { code: course.code })}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            disabled={startingId === course.id}
            onClick={() => void onStart(course)}
          >
            {startingId === course.id
              ? t('home.recommended.starting')
              : t('home.recommended.start', { code: course.code })}
          </Button>
        )}
      </div>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6 pb-10">
      {head}
      <p ref={liveRef} role="status" aria-live="polite" className="sr-only" />

      {/* ── Who you are + your standing ── */}
      <div className="px-8">
        {persona ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Tag>{t(`home.persona.${persona}`)}</Tag>
            {claims?.evaluator_authorized ? (
              <StatusBadge kind="pass" label={t('home.evaluator_badge')} />
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatBlock
            align="start"
            accent
            value={buckets.inProgress.length}
            label={t('home.stat.in_progress')}
          />
          <StatBlock
            align="start"
            value={buckets.completed.length}
            label={t('home.stat.completed')}
          />
          <StatBlock
            align="start"
            value={credentialCount ?? buckets.completed.length}
            label={t('home.stat.credentials')}
          />
          <StatBlock
            align="start"
            value={buckets.available.length}
            label={t('home.stat.available')}
          />
        </div>

        {buckets.total > 0 ? (
          <div className="mt-4 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-caption text-ink-muted">
              <span>{t('home.progress_label')}</span>
              <span className="font-label text-ink-soft">{pct}%</span>
            </div>
            <ProgressBar
              value={buckets.completed.length / buckets.total}
              label={t('home.progress_label')}
            />
          </div>
        ) : null}
      </div>

      {/* ── Continue + Recommended ── */}
      <div className="grid gap-4 px-8 lg:grid-cols-2">
        <section aria-label={t('home.continue.title')} className="flex flex-col gap-2">
          <h2 className="text-eyebrow font-label uppercase tracking-eyebrow text-redex-bright">
            {t('home.continue.title')}
          </h2>
          {buckets.resume ? (
            <CourseCta course={buckets.resume} kind="resume" />
          ) : (
            <Card variant="glass" padding="lg">
              <p className="text-body text-ink-muted">{t('home.continue.none')}</p>
            </Card>
          )}
        </section>

        <section aria-label={t('home.recommended.title')} className="flex flex-col gap-2">
          <h2 className="text-eyebrow font-label uppercase tracking-eyebrow text-redex-bright">
            {t('home.recommended.title')}
          </h2>
          {buckets.recommended ? (
            <CourseCta course={buckets.recommended} kind="start" />
          ) : (
            <Card variant="glass" padding="lg">
              <p className="text-body text-ink-muted">{t('home.recommended.none')}</p>
            </Card>
          )}
        </section>
      </div>

      {startError ? (
        <p role="alert" className="px-8 text-caption text-state-fail">
          {startError}
        </p>
      ) : null}

      {/* ── Explore ── */}
      <div className="px-8">
        <h2 className="mb-2 text-eyebrow font-label uppercase tracking-eyebrow text-redex-bright">
          {t('home.explore.title')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => navigate({ screen: 'constellation', course: null, unit: null })}
            className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-redex"
          >
            <Card variant="raised" eyebrow="★" title={t('home.explore.map')}>
              <p className="text-caption text-ink-muted">{t('home.explore.map_desc')}</p>
            </Card>
          </button>
          <button
            type="button"
            onClick={() => navigate({ screen: 'catalog', course: null, unit: null })}
            className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-redex"
          >
            <Card variant="raised" eyebrow="≣" title={t('home.explore.catalog')}>
              <p className="text-caption text-ink-muted">{t('home.explore.catalog_desc')}</p>
            </Card>
          </button>
          <button
            type="button"
            onClick={() => navigate({ screen: 'backpack', course: null, unit: null })}
            className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-redex"
          >
            <Card variant="raised" eyebrow="❖" title={t('home.explore.backpack')}>
              <p className="text-caption text-ink-muted">{t('home.explore.backpack_desc')}</p>
            </Card>
          </button>
        </div>
      </div>
    </div>
  );
}
