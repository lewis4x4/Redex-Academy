import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';
import { Card } from '../components/Card';
import { EmptyState } from '../components/States';
import { ScreenHead, type ScreenHeadProps } from '../shell/ScreenHead';

export interface ManagerDashboardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Eyebrow above the title (defaults to "MANAGER"). */
  eyebrow?: ScreenHeadProps['eyebrow'];
  /** Page title (defaults to "Team"). */
  title?: ScreenHeadProps['title'];
  /** Optional red-accented trailing word in the title (e.g. "Overview"). */
  accent?: ScreenHeadProps['accent'];
  /** Muted supporting copy under the title. */
  subtitle?: ScreenHeadProps['subtitle'];
  /** Right-aligned header actions (export, date range, etc.). */
  actions?: ScreenHeadProps['actions'];
  /**
   * Row of HUD stats — M11 fills with <StatBlock/> tiles. Each is wrapped in a
   * panel cell so the strip reads as a consistent metric band.
   */
  stats?: ReactNode;
  /** Optional filter controls (search, role/site filters). Rendered above the table. */
  filters?: ReactNode;
  /**
   * The main team/progress table region — M11 fills with the data table. When
   * omitted, the on-brand EmptyState placeholder renders in its place.
   */
  table?: ReactNode;
}

// On-brand zero-data placeholder for the table region (M11 supplies real data).
// Meaning is carried by the title + description text, never color alone.
const TABLE_EMPTY = (
  <EmptyState
    title="No team data yet"
    description="Once your team starts training, their progress and competency rollups will appear here."
  />
);

/**
 * ManagerDashboard — a LAYOUT SHELL for the manager overview screen (D1; M11 fills
 * the data). It is a declarative frame of NAMED SLOTS only: no fetching, state, or
 * feature logic lives here.
 *
 * Composition: a {@link ScreenHead} header · an optional {@link filters} bar · a
 * `{stats}` strip of HUD {@link StatBlock} tiles laid out in panel {@link Card} cells ·
 * a main `{table}` slot inside a panel surface (falls back to an {@link EmptyState}
 * placeholder when no `table` is provided).
 *
 * a11y: each region is a labelled landmark (`<section aria-label>`) so the dashboard is
 * screen-reader navigable; the empty placeholder announces politely via EmptyState's
 * `role="status"`. Colorblind-safe + reduced-motion-safe by construction (all visuals
 * come from token-backed kit primitives). Forwards its ref + spreads ...rest.
 */
export const ManagerDashboard = forwardRef<HTMLElement, ManagerDashboardProps>(
  function ManagerDashboard(
    {
      eyebrow = 'MANAGER',
      title = 'Team',
      accent,
      subtitle,
      actions,
      stats,
      filters,
      table,
      className,
      ...rest
    },
    ref,
  ) {
    return (
      <section
        ref={ref}
        aria-label="Manager dashboard"
        className={cx('flex flex-col gap-6 pb-8', className)}
        {...rest}
      >
        <ScreenHead
          eyebrow={eyebrow}
          title={title}
          accent={accent}
          subtitle={subtitle}
          actions={actions}
        />

        <div className="flex flex-col gap-6 px-8">
          {filters != null ? (
            <section aria-label="Filters" className="flex flex-wrap items-center gap-3">
              {filters}
            </section>
          ) : null}

          {stats != null ? (
            <section aria-label="Team metrics" className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {stats}
            </section>
          ) : null}

          <section aria-label="Team progress">
            <Card variant="panel" padding="md" className="bg-panel-2">
              {table != null ? table : TABLE_EMPTY}
            </Card>
          </section>
        </div>
      </section>
    );
  },
);
