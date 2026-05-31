import { ErrorState, LessonReader, Skeleton } from '@redex/ui';
import { useEffect, useMemo, useState, type ComponentType, type ReactElement } from 'react';
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

export interface LessonScreenProps {
  unitId: string;
  online?: boolean;
  onExit?: () => void;
}

type MdxComponent = ComponentType<{ components?: Record<string, unknown> }>;

/**
 * LessonScreen (M2) — resolves a lesson unit, runtime-compiles its committed MDX
 * body, and renders it inside the @redex/ui LessonReader with the embeddable
 * component contract (Sim / KnowledgeCheck / Callout / Checklist / Media) and a
 * live EN↔ES locale toggle. All reads are RLS-scoped; nothing writes state.
 */
export function LessonScreen({ unitId, online = true, onExit }: LessonScreenProps): ReactElement {
  const { t } = useTranslation();
  const { session, claims } = useAuth();
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [Mdx, setMdx] = useState<MdxComponent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState<'en' | 'es'>(i18n.language === 'es' ? 'es' : 'en');

  useEffect(() => {
    let live = true;
    setError(null);
    setLesson(null);
    setMdx(null);
    (async () => {
      try {
        const data = await loadLesson(unitId);
        if (!live) return;
        setLesson(data);
        const raw = getLessonMdx(data.mdxKey);
        if (!raw) {
          setError(t('lesson.no_body'));
          return;
        }
        const mod = await evaluate(raw, {
          Fragment,
          jsx,
          jsxs,
          remarkPlugins: [remarkGfm],
        });
        if (!live) return;
        setMdx(() => mod.default as MdxComponent);
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : 'lesson failed to load');
      }
    })();
    return () => {
      live = false;
    };
  }, [unitId, t]);

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

  const header = (
    <div className="flex items-center justify-between gap-4">
      <span className="font-label text-subtitle text-white">{lesson?.title ?? ''}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="lesson-locale-toggle"
          aria-label={t('lesson.toggle_locale')}
          onClick={toggleLocale}
          className="rounded-pill border border-line px-3 py-1 font-label text-label uppercase text-ink hover:bg-surface-hover"
        >
          {locale}
        </button>
        {onExit ? (
          <button
            type="button"
            data-testid="lesson-exit"
            onClick={onExit}
            className="rounded-pill border border-line px-3 py-1 font-label text-ink hover:bg-surface-hover"
          >
            {t('lesson.back')}
          </button>
        ) : null}
      </div>
    </div>
  );

  let body: ReactElement;
  if (error) {
    body = <ErrorState title={t('lesson.error_title')} description={error} />;
  } else if (!Mdx || !ctx) {
    body = (
      <div className="flex flex-col gap-3" data-testid="lesson-loading">
        <Skeleton height="1.5rem" width="60%" />
        <Skeleton height="6rem" />
      </div>
    );
  } else {
    body = (
      <LessonProvider value={ctx}>
        <div data-testid="lesson-body" className="flex flex-col gap-4">
          <Mdx components={mdxComponents} />
        </div>
      </LessonProvider>
    );
  }

  return (
    <div data-testid="lesson-screen" className="px-8 pt-2 pb-10">
      <LessonReader header={header}>{body}</LessonReader>
    </div>
  );
}
