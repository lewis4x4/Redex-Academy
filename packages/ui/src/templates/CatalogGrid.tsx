import { Children, forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';
import { EmptyState } from '../components/States';

export interface CatalogGridProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Optional header region (e.g. a <ScreenHead/>), rendered above the filters + grid. */
  header?: ReactNode;
  /** Optional filter region (e.g. a row of <Chip/>s), rendered between header + grid. */
  filters?: ReactNode;
  /** The course cards. When none are supplied, the on-brand empty placeholder renders. */
  children?: ReactNode;
  /** Headline for the built-in EmptyState shown when there are no cards. */
  emptyLabel?: ReactNode;
  /** Muted supporting copy for the built-in EmptyState. */
  emptyDescription?: ReactNode;
  /**
   * Minimum column width for the auto-fill grid track (any CSS length). Cards grow to
   * fill the row; the column count adapts to the container. Default `'18rem'`.
   */
  minColumnWidth?: number | string;
}

// Layout-only recipe (D1 templates). Token classes only — no raw hex. The grid uses an
// inline `gridTemplateColumns` so the auto-fill minmax track width is caller-tunable
// without baking arbitrary values into the class list. Gap is the standard card rhythm.
const GRID_BASE = 'grid gap-4';

const toLength = (v: number | string): string => (typeof v === 'number' ? `${v}px` : v);

/**
 * CatalogGrid — a module-archetype LAYOUT SHELL (D1, goal D1) for a course catalog. It is
 * a declarative frame only: NO gating, fetching, or state — those arrive later (catalog
 * gating = M1). It composes named slots (`header`, `filters`) above a responsive auto-fill
 * grid of course Card slots passed as `children`. When no cards are supplied it shows the
 * kit's on-brand <EmptyState/> instead of an empty grid. Forwards its ref + spreads ...rest
 * onto the section wrapper, and merges an external className via cx.
 */
export const CatalogGrid = forwardRef<HTMLDivElement, CatalogGridProps>(function CatalogGrid(
  {
    header,
    filters,
    children,
    emptyLabel = 'No courses yet',
    emptyDescription,
    minColumnWidth = '18rem',
    className,
    ...rest
  },
  ref,
) {
  const hasCards = Children.count(children) > 0;
  return (
    <section ref={ref} className={cx('flex flex-col gap-4', className)} {...rest}>
      {header != null ? <div>{header}</div> : null}
      {filters != null ? (
        <div className="flex flex-wrap items-center gap-2 px-8">{filters}</div>
      ) : null}
      {hasCards ? (
        <div
          className={GRID_BASE}
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${toLength(minColumnWidth)}, 1fr))`,
          }}
        >
          {children}
        </div>
      ) : (
        <EmptyState title={emptyLabel} description={emptyDescription} />
      )}
    </section>
  );
});
