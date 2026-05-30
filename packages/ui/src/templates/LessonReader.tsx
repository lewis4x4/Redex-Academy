import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';
import { EmptyState } from '../components/States';

// `title` is widened away below by Omit; LessonReader takes ReactNode slots, not the
// native string `title` tooltip attribute, so the two never collide.
export interface LessonReaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Optional masthead above the reading column (e.g. a <ScreenHead/> or lesson title). */
  header?: ReactNode;
  /**
   * The lesson body — the MDX/JSON content slot (M2 fills this). When omitted, an
   * on-brand EmptyState placeholder renders so the frame never looks broken in dev.
   */
  children?: ReactNode;
  /** Optional right rail (e.g. table of contents, glossary, progress). Hidden below lg. */
  aside?: ReactNode;
  /** Optional prev/next footer navigation slot, pinned below the column. */
  footerNav?: ReactNode;
}

// The reading column: a comfortable prose measure on the panel surface with relaxed
// line-height. `max-w-[68ch]` keeps lines in the readable 45–75ch band; the panel
// surface + card radius match the kit's content cards. Token classes only — no raw hex.
const COLUMN = 'mx-auto w-full max-w-[68ch] leading-relaxed text-body-lg text-ink';

const SHELL = 'mx-auto w-full max-w-[1120px] px-6 py-8';

/**
 * LessonReader — a centered reading column for lessons (D1; M2 fills the content slot).
 * A pure LAYOUT SHELL: it owns measure, rhythm, and named slots (`header`, `children`,
 * `aside`, `footerNav`) but NO content/data logic. The body renders in a comfortable
 * prose column on the panel surface; an optional right rail sits beside it on wide
 * viewports and stacks below on narrow ones. When no content is passed, an on-brand
 * EmptyState placeholder stands in. Semantic <article> + <aside> + <nav> keep the
 * document outline correct and screen-reader navigable. Reduced-motion-safe (no motion).
 * Forwards its ref + spreads ...rest.
 */
export const LessonReader = forwardRef<HTMLElement, LessonReaderProps>(function LessonReader(
  { header, children, aside, footerNav, className, ...rest },
  ref,
) {
  const hasContent = children != null;
  return (
    <article ref={ref} className={cx(SHELL, className)} {...rest}>
      {header != null ? <header className="mb-6">{header}</header> : null}

      <div className={cx('flex flex-col gap-8', aside != null && 'lg:flex-row lg:gap-10')}>
        <div className={cx('min-w-0 flex-1', aside != null && 'lg:max-w-[68ch]')}>
          {hasContent ? (
            <div className={COLUMN}>{children}</div>
          ) : (
            <div className={COLUMN}>
              <EmptyState
                title="No lesson content yet"
                description="This reading column is ready — the lesson body renders here once authored."
              />
            </div>
          )}
        </div>

        {aside != null ? (
          <aside
            aria-label="Lesson sidebar"
            className="w-full shrink-0 lg:sticky lg:top-8 lg:w-[280px] lg:self-start"
          >
            {aside}
          </aside>
        ) : null}
      </div>

      {footerNav != null ? (
        <nav
          aria-label="Lesson navigation"
          className="mx-auto mt-10 w-full max-w-[68ch] border-t border-line pt-5"
        >
          {footerNav}
        </nav>
      ) : null}
    </article>
  );
});
