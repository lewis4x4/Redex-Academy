import {
  Button,
  Card,
  ErrorState,
  Input,
  ProgressBar,
  ScreenHead,
  Skeleton,
  StatBlock,
  Tag,
  cx,
} from '@redex/ui';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { updateDisplayName } from '../auth/authClient';
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

// English persona-path labels — i18next defaults for home.persona.* so the chip
// reads correctly even before the locale bundle ships the key.
const PERSONA_LABEL: Record<Persona, string> = {
  nova: 'New technician path',
  marco: 'Field technician path',
  priya: 'Office / coordinator path',
  dana: 'Leadership path',
};

function tierRank(tier: Tier): number {
  const i = TIER_ORDER.indexOf(tier);
  return i === -1 ? 99 : i;
}

/** Title-case a raw email handle ("b.lewis" → "B Lewis", "jsmith" → "Jsmith"). */
function humanizeHandle(handle: string): string {
  return handle
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

/**
 * The learner Home — a personalized welcome screen (the default landing). A bold
 * greeting hero with ONE focused next action (Continue / Start), a compact standing
 * strip, and an Explore row. The Constellation skill-map lives one click away as its
 * own sub-page. On a learner's first visit (no name on their profile yet) the hero
 * shows a one-time "what should we call you?" prompt that saves the name to their
 * auth profile, so every later visit greets them by name.
 *
 * All catalog facts come from the RLS-scoped M1 read (`loadCatalogGating`); the
 * credential count is a best-effort enhancement that degrades silently. Every string
 * uses an i18next `defaultValue`, so copy renders correctly whether or not the home.*
 * keys are in the locale bundle (a translation wins when present).
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const { session, claims } = useAuth();
  const { navigate } = useAppRoute();
  const persona = claims?.persona as Persona | undefined;

  // t() with an English default baked in.
  const tt = useCallback(
    (key: string, def: string, opts?: Record<string, unknown>) =>
      t(key, { defaultValue: def, ...opts }),
    [t],
  );

  // ── Identity / name ────────────────────────────────────────────────────────
  const meta = (session?.user.user_metadata ?? {}) as Record<string, unknown>;
  const explicitName =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    '';
  const hasName = explicitName.length > 0;
  const emailHandle = session?.user.email ? (session.user.email.split('@')[0] ?? '') : '';
  const firstToken = (explicitName || emailHandle).trim().split(/[\s.]+/)[0] ?? '';
  const name = firstToken
    ? firstToken.charAt(0).toUpperCase() + firstToken.slice(1)
    : tt('home.fallback_name', 'there');

  // First-run name prompt: shown until the learner saves a name (or skips this
  // session). Never shown once a real name exists on the profile.
  const [skippedNamePrompt, setSkippedNamePrompt] = useState(false);
  // Prefill the draft once with the humanized email handle as a friendly suggestion
  // (lazy init — runs at mount, when the authed session/email is already present).
  const [nameDraft, setNameDraft] = useState(() =>
    !hasName && emailHandle ? humanizeHandle(emailHandle) : '',
  );
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const showNamePrompt = !hasName && !skippedNamePrompt;

  const onSaveName = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const value = nameDraft.trim();
      if (!value) return;
      setSavingName(true);
      setNameError(null);
      const r = await updateDisplayName(value);
      setSavingName(false);
      if (!r.ok) setNameError(r.error);
      // On success the USER_UPDATED auth event refreshes the session → hasName flips
      // → the prompt disappears and the greeting uses the new name.
    },
    [nameDraft],
  );

  // ── Catalog + progress ─────────────────────────────────────────────────────
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

  // Best-effort active-credential count (RLS-scoped). Non-fatal: any failure leaves
  // the stat hidden. Wrapped in try/catch because the query is built synchronously —
  // a stubbed/absent supabase client (e.g. in unit tests) must never crash the
  // dashboard, mirroring how loadCatalogGating's errors are swallowed.
  useEffect(() => {
    let live = true;
    try {
      void supabase
        .schema('academy')
        .from('credentials')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .then(({ count, error: e }) => {
          if (live && !e && typeof count === 'number') setCredentialCount(count);
        });
    } catch {
      /* best-effort: a missing/stubbed client must not crash the dashboard */
    }
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
    const resume =
      [...inProgress].sort(
        (a, b) =>
          Number(SIM_COURSES.has(b.code)) - Number(SIM_COURSES.has(a.code)) || byProgression(a, b),
      )[0] ?? null;
    const recommended =
      [...available].sort(
        (a, b) =>
          Number(persona ? b.personas.includes(persona) : false) -
            Number(persona ? a.personas.includes(persona) : false) || byProgression(a, b),
      )[0] ?? null;
    return { inProgress, completed, available, resume, recommended, total: courses.length };
  }, [data, persona]);

  const stateLabel = useCallback((s: GatingState) => t(`catalog.state.${s}`), [t]);

  // Where "open this course" goes: a sim course → its sim; a course with a lesson →
  // that first lesson; otherwise fall back to the skill-map (never a dead end).
  const openCourse = useCallback(
    (course: CourseNode) => {
      if (SIM_COURSES.has(course.code)) {
        navigate({ screen: 'sim', course: course.code, unit: null });
      } else if (course.firstUnitId) {
        navigate({ screen: 'lesson', course: null, unit: course.firstUnitId });
      } else {
        navigate({ screen: 'constellation', course: null, unit: null });
      }
    },
    [navigate],
  );

  const onStart = useCallback(
    async (course: CourseNode) => {
      setStartingId(course.id);
      setStartError(null);
      try {
        // Self-enroll only when we have the identity claims for the RLS write. A
        // learner without an org_id (e.g. self-signed-up, not yet invited) can still
        // OPEN the course — lessons are published + cross-tenant readable; only the
        // enrollment write needs an org. So never dead-end to the map: open the
        // content regardless, and enroll opportunistically when possible.
        if (claims?.sub && claims.org_id) {
          await enrollSelf({ userId: claims.sub, orgId: claims.org_id, courseId: course.id });
          if (liveRef.current)
            liveRef.current.textContent = t('catalog.enrolled', { code: course.code });
        }
        openCourse(course);
      } catch (e: unknown) {
        // Enroll failed (e.g. RLS) — still open the content; surface the note.
        setStartError(e instanceof Error ? e.message : String(e));
        openCourse(course);
      } finally {
        setStartingId(null);
      }
    },
    [claims, openCourse, t],
  );

  // The single focused action: resume in-progress, else start the recommended.
  const spotlight = buckets.resume ?? buckets.recommended ?? null;
  const spotlightKind: 'resume' | 'start' = buckets.resume ? 'resume' : 'start';
  const started = buckets.completed.length + buckets.inProgress.length > 0;
  const pct = buckets.total > 0 ? Math.round((buckets.completed.length / buckets.total) * 100) : 0;

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col gap-8 px-6 pb-12 pt-4 sm:px-8 lg:px-10">
        <Skeleton height={220} rounded="card" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={88} rounded="card" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 pb-12 pt-4 sm:px-8 lg:px-10">
        <ScreenHead
          eyebrow={tt('home.eyebrow', 'Your dashboard')}
          title={tt('home.greeting_new', 'Welcome, {{name}}', { name })}
        />
        <div className="mt-4">
          <ErrorState
            title={tt('home.error_title', "We couldn't load your dashboard.")}
            description={error}
            onRetry={reload}
            retryLabel={t('catalog.retry')}
          />
        </div>
      </div>
    );
  }

  // ── The spotlight (focused next action) panel ──────────────────────────────
  const spotlightPanel = spotlight ? (
    <div className="flex flex-col gap-4">
      <span className="text-eyebrow font-label uppercase tracking-eyebrow text-redex-bright">
        {spotlightKind === 'resume'
          ? tt('home.continue.title', 'Continue learning')
          : started
            ? tt('home.recommended.title', 'Recommended next')
            : tt('home.get_started', 'Get started')}
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-eyebrow font-label uppercase tracking-eyebrow text-ink-muted">
          {spotlight.code}
        </span>
        <h2 className="text-h2 font-bold tracking-tighttitle text-white">{spotlight.title}</h2>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Tag variant="tier">{t(`catalog.tier.${spotlight.tier}`)}</Tag>
        <Tag>{spotlight.domain}</Tag>
        {spotlight.isBoss ? <Tag variant="gate">{t('catalog.gate')}</Tag> : null}
        <span className="inline-flex items-center gap-1.5 text-caption text-ink-soft">
          <span
            className={cx('inline-block h-2 w-2 rounded-full', STATE_DOT[spotlight.state])}
            aria-hidden="true"
          />
          {stateLabel(spotlight.state)}
        </span>
      </div>
      <div className="pt-1">
        {spotlightKind === 'resume' ? (
          <Button variant="cta" onClick={() => openCourse(spotlight)}>
            {tt('home.continue.resume', 'Resume {{code}}', { code: spotlight.code })}
          </Button>
        ) : (
          <Button
            variant="cta"
            disabled={startingId === spotlight.id}
            onClick={() => void onStart(spotlight)}
          >
            {startingId === spotlight.id
              ? tt('home.recommended.starting', 'Starting…')
              : tt('home.recommended.start', 'Start {{code}}', { code: spotlight.code })}
          </Button>
        )}
      </div>
      {startError ? (
        <p role="alert" className="text-caption text-state-fail">
          {startError}
        </p>
      ) : null}
    </div>
  ) : (
    <div className="flex flex-col gap-4">
      <span className="text-eyebrow font-label uppercase tracking-eyebrow text-redex-bright">
        {tt('home.all_caught_up.title', 'All caught up')}
      </span>
      <p className="text-body-lg text-ink-soft">
        {tt('home.all_caught_up.desc', "You've started everything that's unlocked. Nice work.")}
      </p>
      <div className="pt-1">
        <Button
          variant="primary"
          size="lg"
          onClick={() => navigate({ screen: 'catalog', course: null, unit: null })}
        >
          {tt('home.browse_catalog', 'Browse the catalog')}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-8 px-6 pb-12 pt-4 sm:px-8 lg:px-10">
      <p ref={liveRef} role="status" aria-live="polite" className="sr-only" />

      {/* ── HERO: greeting + the one focused action ─────────────────────────── */}
      <section
        aria-label={tt('home.eyebrow', 'Your dashboard')}
        className="relative overflow-hidden rounded-card border border-line bg-surface-1"
      >
        {/* brand core-glow wash, decorative */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-red-tint blur-3xl"
        />
        <div className="relative grid gap-8 p-7 sm:p-9 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          {/* Greeting (or first-run name capture) */}
          <div className="flex flex-col gap-4">
            <span className="text-eyebrow font-label uppercase tracking-eyebrow text-redex-bright">
              {tt('home.eyebrow', 'Your dashboard')}
            </span>

            {showNamePrompt ? (
              <form
                onSubmit={onSaveName}
                className="flex flex-col gap-3"
                aria-label="Set your name"
              >
                <h1 className="text-display font-bold tracking-tighttitle text-white">
                  {tt('home.name_prompt.title', 'What should we call you?')}
                </h1>
                <p className="max-w-prose text-body text-ink-muted">
                  {tt(
                    'home.name_prompt.desc',
                    "We'll use your name to personalize your dashboard and credentials.",
                  )}
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="sm:w-72">
                    <Input
                      label={tt('home.name_prompt.label', 'Your name')}
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      autoComplete="name"
                      maxLength={60}
                      placeholder="Jordan Rivera"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="submit" variant="cta" disabled={savingName || !nameDraft.trim()}>
                      {savingName
                        ? tt('home.name_prompt.saving', 'Saving…')
                        : tt('home.name_prompt.save', 'Save')}
                    </Button>
                    <button
                      type="button"
                      className="text-caption text-ink-muted underline-offset-2 hover:text-white hover:underline"
                      onClick={() => setSkippedNamePrompt(true)}
                    >
                      {tt('home.name_prompt.skip', 'Skip for now')}
                    </button>
                  </div>
                </div>
                {nameError ? (
                  <p role="alert" className="text-caption text-state-fail">
                    {nameError}
                  </p>
                ) : null}
              </form>
            ) : (
              <>
                <h1 className="text-display font-bold tracking-tighttitle text-white">
                  {started
                    ? tt('home.greeting', 'Welcome back, {{name}}', { name })
                    : tt('home.greeting_new', 'Welcome, {{name}}', { name })}
                </h1>
                <p className="max-w-prose text-body-lg text-ink-muted">
                  {tt('home.subtitle', "Here's where you stand and what to do next.")}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {persona ? (
                    <Tag variant="tier">
                      {tt(`home.persona.${persona}`, PERSONA_LABEL[persona])}
                    </Tag>
                  ) : null}
                  {claims?.evaluator_authorized ? (
                    <Tag>{tt('home.evaluator_badge', 'Authorized evaluator')}</Tag>
                  ) : null}
                </div>
              </>
            )}
          </div>

          {/* The single focused action */}
          <Card variant="raised" padding="lg" className="shadow-glow-soft">
            {spotlightPanel}
          </Card>
        </div>
      </section>

      {/* ── STANDING: compact stat strip + progress ─────────────────────────── */}
      <section
        aria-label={tt('home.progress_label', 'Overall progress')}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card variant="raised" padding="md">
            <StatBlock
              align="start"
              accent
              value={buckets.inProgress.length}
              label={tt('home.stat.in_progress', 'In progress')}
            />
          </Card>
          <Card variant="raised" padding="md">
            <StatBlock
              align="start"
              value={buckets.completed.length}
              label={tt('home.stat.completed', 'Completed')}
            />
          </Card>
          <Card variant="raised" padding="md">
            <StatBlock
              align="start"
              value={credentialCount ?? buckets.completed.length}
              label={tt('home.stat.credentials', 'Credentials')}
            />
          </Card>
          <Card variant="raised" padding="md">
            <StatBlock
              align="start"
              value={buckets.available.length}
              label={tt('home.stat.available', 'Ready to start')}
            />
          </Card>
        </div>
        {buckets.total > 0 ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-caption text-ink-muted">
              <span>{tt('home.progress_label', 'Overall progress')}</span>
              <span className="font-label text-ink-soft">
                {tt('home.progress_count', '{{done}} of {{total}} · {{pct}}%', {
                  done: buckets.completed.length,
                  total: buckets.total,
                  pct,
                })}
              </span>
            </div>
            <ProgressBar
              value={buckets.completed.length / buckets.total}
              label={tt('home.progress_label', 'Overall progress')}
            />
          </div>
        ) : null}
      </section>

      {/* ── EXPLORE ─────────────────────────────────────────────────────────── */}
      <section aria-label={tt('home.explore.title', 'Explore')} className="flex flex-col gap-3">
        <h2 className="text-eyebrow font-label uppercase tracking-eyebrow text-redex-bright">
          {tt('home.explore.title', 'Explore')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              {
                key: 'map',
                glyph: '★',
                title: tt('home.explore.map', 'Skill map'),
                desc: tt('home.explore.map_desc', 'See how every course connects.'),
                go: () => navigate({ screen: 'constellation', course: null, unit: null }),
              },
              {
                key: 'catalog',
                glyph: '≣',
                title: tt('home.explore.catalog', 'Course catalog'),
                desc: tt('home.explore.catalog_desc', 'Browse every course as a list.'),
                go: () => navigate({ screen: 'catalog', course: null, unit: null }),
              },
              {
                key: 'backpack',
                glyph: '❖',
                title: tt('home.explore.backpack', 'Digital backpack'),
                desc: tt('home.explore.backpack_desc', 'Your earned, verifiable credentials.'),
                go: () => navigate({ screen: 'backpack', course: null, unit: null }),
              },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={item.go}
              className="group text-left transition-transform duration-nav ease-out hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-redex"
            >
              <Card
                variant="raised"
                padding="lg"
                className="h-full transition-shadow group-hover:shadow-glow-soft"
              >
                <div className="flex flex-col gap-2">
                  <span aria-hidden="true" className="text-h2 text-redex-bright">
                    {item.glyph}
                  </span>
                  <h3 className="text-body-lg font-bold text-white">{item.title}</h3>
                  <p className="text-caption text-ink-muted">{item.desc}</p>
                </div>
              </Card>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
