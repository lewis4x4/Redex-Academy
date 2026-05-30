import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';
import { Card } from '../components/Card';
import { EmptyState } from '../components/States';

export interface BackpackWallProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * Header slot — the wall's title/eyebrow region (e.g. a <ScreenHead/>). Rendered above
   * the stats + filters. Optional: omit for a bare grid.
   */
  header?: ReactNode;
  /**
   * Stat slot — one or more <StatBlock/>s summarizing the backpack (badges earned, proof
   * points). Laid out in a wrapping row. M7 fills these with earned data.
   */
  stats?: ReactNode;
  /**
   * Optional domain filter slot — a row of <Chip/>s scoping the wall by domain. M1/M7 wire
   * the selection behavior; this template only frames them (no filtering logic here).
   */
  filters?: ReactNode;
  /**
   * The trophy grid contents — a set of <TrophyMedal/> slots. When omitted/empty the wall
   * renders {@link emptyState} (or the default on-brand placeholder) instead of the grid.
   * NO issuance logic lives here — M7 supplies the earned medals.
   */
  children?: ReactNode;
  /**
   * Override the default empty placeholder (e.g. a tailored <EmptyState/>). Shown when no
   * children are provided.
   */
  emptyState?: ReactNode;
}

// Token-class recipes (D1) — token Tailwind classes only, no raw hex. The wall is a panel
// Card framing a header band (stats + optional filter chips) above a responsive medal grid.
// The grid is auto-fill so M7's earned medals reflow without this shell knowing the count.
const HEADER_BAND = 'flex flex-col gap-3';
const STAT_ROW = 'flex flex-wrap items-end gap-x-6 gap-y-3';
const FILTER_ROW = 'flex flex-wrap items-center gap-2';
const GRID = 'grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(7rem,1fr))]';

// Default empty placeholder — the kit's on-brand EmptyState. M7 replaces the copy/CTA via
// the `emptyState` slot; meaning is carried by the glyph + text (colorblind-safe).
const DEFAULT_EMPTY = (
  <EmptyState
    icon={
      <span aria-hidden="true" className="text-stat leading-none">
        🎒
      </span>
    }
    title="Your backpack is empty"
    description="Earned trophies will appear here as you prove competencies in the field."
  />
);

/**
 * BackpackWall — the Digital Backpack trophy WALL layout (module archetype, D1; M7 fills
 * earned data). A LAYOUT SHELL ONLY: a header slot + a stats row (StatBlocks) + an optional
 * domain-filter chip row, above a responsive grid of <TrophyMedal/> slots (children). Shows
 * an on-brand EmptyState when no medals are passed. NO issuance/filter/earned logic — those
 * are M-goal concerns. Composes the kit's Card + EmptyState; renders a labelled <section> so
 * the wall is screen-reader navigable. Forwards its ref, spreads ...rest, merges className.
 */
export const BackpackWall = forwardRef<HTMLDivElement, BackpackWallProps>(function BackpackWall(
  { header, stats, filters, children, emptyState, className, ...rest },
  ref,
) {
  const hasHeaderBand = header != null || stats != null || filters != null;
  const isEmpty = children == null || (Array.isArray(children) && children.length === 0);
  return (
    <Card
      ref={ref}
      role="region"
      aria-label="Digital backpack"
      padding="lg"
      className={cx('flex flex-col gap-6', className)}
      {...rest}
    >
      {hasHeaderBand ? (
        <div className={HEADER_BAND}>
          {header != null ? <div>{header}</div> : null}
          {stats != null ? <div className={STAT_ROW}>{stats}</div> : null}
          {filters != null ? (
            <div className={FILTER_ROW} role="group" aria-label="Filter trophies by domain">
              {filters}
            </div>
          ) : null}
        </div>
      ) : null}
      {isEmpty ? (
        emptyState != null ? (
          emptyState
        ) : (
          DEFAULT_EMPTY
        )
      ) : (
        <div className={GRID} role="list" aria-label="Earned trophies">
          {children}
        </div>
      )}
    </Card>
  );
});
