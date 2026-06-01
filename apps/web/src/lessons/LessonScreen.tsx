import {
  Button,
  Card,
  ErrorState,
  LessonOutlineRail,
  ProgressBar,
  ProgressDots,
  Skeleton,
  type LessonOutlineStep,
  type ProgressDotState,
} from '@redex/ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactElement,
} from 'react';
import { useTranslation } from 'react-i18next';
import { i18n } from '@redex/i18n';
import remarkGfm from 'remark-gfm';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { evaluate } from '@mdx-js/mdx';
import { useAuth } from '../auth/useAuth';
import { LessonProvider } from './LessonContext';
import { getLessonMdx } from './lessonContent';
import { type LessonData, loadLesson } from './lessonSource';
import { mdxComponents } from './mdxComponents';
import { type LessonStep, splitMdxByHeadings } from './lessonSteps';

export interface LessonScreenProps {
  unitId: string;
  online?: boolean;
  onExit?: () => void;
}

type MdxComponent = ComponentType<{ components?: Record<string, unknown> }>;

/** True when focus sits in a text/form control, so keyboard step-nav must not steal
 *  ArrowUp/Down from a sim/KC input (the form controls own those keys). */
function focusInFormControl(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'select' || tag === 'textarea' || el.isContentEditable === true;
}

/**
 * StepBody — evaluates and renders ONE step's MDX chunk. Mounted under the runner's
 * single LessonProvider, so <Sim>/<KnowledgeCheck> still resolve context. Re-evaluates
 * whenever the step's rawMdx OR the locale changes (locale re-eval is required so the
 * embedded check chrome flips EN↔ES on the current step). The `key={ordinal}` from the
 * parent re-triggers the fadeUp keyframe on step change.
 */
function StepBody({ step, locale }: { step: LessonStep; locale: 'en' | 'es' }): ReactElement {
  const { t } = useTranslation();
  const [Mdx, setMdx] = useState<MdxComponent | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The chunk currently being rendered, so a locale-only re-evaluate can keep the prior
  // render on screen (no skeleton flash, no unmount window) while the new chunk compiles.
  const renderedRawRef = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    // Blank to the skeleton ONLY on a real step change (a different chunk). A locale-only
    // re-evaluate keeps the current render mounted until the new compile resolves.
    if (renderedRawRef.current !== step.rawMdx) {
      setMdx(null);
      renderedRawRef.current = null;
    }
    setError(null);
    (async () => {
      try {
        const mod = await evaluate(step.rawMdx, {
          Fragment,
          jsx,
          jsxs,
          remarkPlugins: [remarkGfm],
        });
        if (live) {
          renderedRawRef.current = step.rawMdx;
          setMdx(() => mod.default as MdxComponent);
        }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : 'step failed to render');
      }
    })();
    return () => {
      live = false;
    };
    // locale is a dependency on purpose: re-evaluate the current step when the learner
    // toggles EN↔ES so the embedded KC/Sim chrome re-renders in the new language.
  }, [step.rawMdx, locale]);

  if (error) {
    return <ErrorState title={t('lesson.error_title')} description={error} />;
  }
  if (!Mdx) {
    return (
      <div className="flex flex-col gap-3" data-testid="lesson-loading">
        <Skeleton height="1.5rem" width="60%" />
        <Skeleton height="6rem" />
      </div>
    );
  }
  return (
    <div data-testid="step-content" data-step={step.ordinal} className="flex flex-col gap-4">
      <Mdx components={mdxComponents} />
    </div>
  );
}

/**
 * LessonScreen (AC-203 course-experience, Phase 1) — the PACED STEP RUNNER. Resolves a
 * lesson unit, splits its committed MDX body at `## ` headings into steps, and walks the
 * learner through ONE step at a time in the real design system: a left outline rail
 * (LessonOutlineRail) + a content Card on wide viewports, a top ProgressBar below `lg`.
 * Only the current step's MDX is evaluated (re-evaluated on step change AND locale
 * change). The single LessonProvider wraps the whole runner so embedded <Sim>/<KnowledgeCheck>
 * resolve context across navigation. No engine/scoring change; reads are RLS-scoped;
 * nothing writes state.
 */
export function LessonScreen({ unitId, online = true, onExit }: LessonScreenProps): ReactElement {
  const { t } = useTranslation();
  const { session, claims } = useAuth();
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState<'en' | 'es'>(i18n.language === 'es' ? 'es' : 'en');
  const [currentStep, setCurrentStep] = useState(0);
  const [furthestReached, setFurthestReached] = useState(0);

  // `t` changes identity on every locale toggle. Hold it in a ref so the LOAD effect
  // depends ONLY on unitId — otherwise a locale toggle would re-run the load and reset
  // the learner to step 1 (the EN↔ES toggle must stay on the current step).
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    let live = true;
    setError(null);
    setLesson(null);
    setRaw(null);
    setCurrentStep(0);
    setFurthestReached(0);
    (async () => {
      try {
        const data = await loadLesson(unitId);
        if (!live) return;
        setLesson(data);
        const body = getLessonMdx(data.mdxKey);
        if (!body) {
          setError(tRef.current('lesson.no_body'));
          return;
        }
        setRaw(body);
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : 'lesson failed to load');
      }
    })();
    return () => {
      live = false;
    };
  }, [unitId]);

  const steps = useMemo(() => (raw ? splitMdxByHeadings(raw) : []), [raw]);
  const total = steps.length;
  const isLast = total > 0 && currentStep >= total - 1;

  const goTo = useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(index, total - 1));
      setCurrentStep(next);
      setFurthestReached((f) => Math.max(f, next));
    },
    [total],
  );

  const goNext = useCallback(() => {
    if (isLast) {
      onExit?.();
      return;
    }
    goTo(currentStep + 1);
  }, [isLast, onExit, goTo, currentStep]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) goTo(currentStep - 1);
  }, [currentStep, goTo]);

  // Keyboard paced-nav: ArrowDown = next, ArrowUp = prev. preventDefault() so the page
  // doesn't also scroll. Suppressed while focus is in a sim/KC form control.
  useEffect(() => {
    if (total === 0) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      if (focusInFormControl()) return;
      e.preventDefault();
      if (e.key === 'ArrowDown') goNext();
      else goPrev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, goNext, goPrev]);

  function toggleLocale() {
    const next = locale === 'en' ? 'es' : 'en';
    setLocale(next);
    void i18n.changeLanguage(next);
  }

  const ctx = useMemo(
    () =>
      lesson && session
        ? {
            lesson,
            userId: session.user.id,
            orgId: claims?.org_id ?? '',
            locale,
            online,
          }
        : null,
    [lesson, session, claims, locale, online],
  );

  const railSteps: LessonOutlineStep[] = useMemo(
    () => steps.map((s) => ({ id: String(s.ordinal), label: s.title })),
    [steps],
  );

  const dotStates: ProgressDotState[] = useMemo(
    () =>
      steps.map(
        (_, i): ProgressDotState =>
          i < currentStep ? 'done' : i === currentStep ? 'current' : 'todo',
      ),
    [steps, currentStep],
  );

  const localeToggle = (
    <button
      type="button"
      data-testid="lesson-locale-toggle"
      aria-label={t('lesson.toggle_locale')}
      onClick={toggleLocale}
      className="rounded-pill border border-line px-3 py-1 font-label text-label uppercase text-ink hover:bg-surface-hover"
    >
      {locale}
    </button>
  );

  // Error / loading: keep the screen frame + testids stable.
  if (error) {
    return (
      <div data-testid="lesson-screen" className="mx-auto w-full max-w-[1120px] px-6 py-8">
        <ErrorState title={t('lesson.error_title')} description={error} />
      </div>
    );
  }
  if (!ctx || total === 0 || steps[currentStep] == null) {
    return (
      <div data-testid="lesson-screen" className="mx-auto w-full max-w-[1120px] px-6 py-8">
        <div className="flex flex-col gap-3" data-testid="lesson-loading">
          <Skeleton height="1.5rem" width="60%" />
          <Skeleton height="6rem" />
        </div>
      </div>
    );
  }

  const step = steps[currentStep];
  const stepCounter = t('lesson.step_counter', { current: currentStep + 1, total });

  return (
    <div data-testid="lesson-screen" className="mx-auto w-full max-w-[1120px] px-6 py-8">
      <LessonProvider value={ctx}>
        {/* Mobile-first: the rail collapses to a top ProgressBar below lg. */}
        <div className="mb-4 lg:hidden">
          <ProgressBar
            value={total > 1 ? currentStep / (total - 1) : 1}
            label={t('lesson.progress')}
          />
        </div>

        <div className="lg:grid lg:grid-cols-[236px_1fr] lg:gap-6">
          <LessonOutlineRail
            className="hidden self-start lg:block"
            steps={railSteps}
            current={currentStep}
            furthestReached={furthestReached}
            onStep={goTo}
            ariaLabel={t('lesson.outline')}
          />

          <Card variant="panel" padding="lg" className="min-w-0">
            {/* Header row: the step eyebrow + the EN↔ES locale toggle. */}
            <div className="mb-1 flex items-start justify-between gap-4">
              <span className="text-eyebrow font-label uppercase tracking-eyebrow text-redex-bright">
                {stepCounter}
              </span>
              <div className="flex items-center gap-2">{localeToggle}</div>
            </div>
            <h1 className="mb-4 text-h1 font-bold tracking-tighttitle text-white">{step.title}</h1>

            {/* The key={currentStep} re-triggers the reduced-motion-gated fadeUp on step change. */}
            <div key={currentStep} className="rdx-anim-fadeup">
              <StepBody step={step} locale={locale} />
            </div>

            {/* Footer: Back · ProgressDots · Next (flips to "Continue the course" on the last step). */}
            <nav
              aria-label={t('lesson.progress')}
              className="mt-6 flex items-center justify-between gap-4 border-t border-line pt-5"
            >
              <Button
                variant="secondary"
                data-testid="lesson-back"
                disabled={currentStep === 0}
                onClick={goPrev}
              >
                {t('lesson.back')}
              </Button>
              <ProgressDots
                className="hidden sm:flex"
                steps={dotStates}
                label={t('lesson.progress')}
              />
              <Button variant="primary" data-testid="lesson-next" onClick={goNext}>
                {isLast ? t('lesson.continue_course') : t('lesson.next')}
              </Button>
            </nav>
          </Card>
        </div>
      </LessonProvider>
    </div>
  );
}
