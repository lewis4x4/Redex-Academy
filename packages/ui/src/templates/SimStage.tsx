import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';
import { Card } from '../components/Card';
import { EmptyState } from '../components/States';

export interface SimStageProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * The main runtime surface where F5's sim renderer mounts (the 3D canvas, the
   * state-machine board, the 2D-interaction layer, …). This is a SLOT — the engine
   * is F5 / M3-5; this template only frames it. When empty, an on-brand placeholder
   * is shown so the layout reads in storybook / authoring before an engine exists.
   */
  stage?: ReactNode;
  /**
   * The right rail. Holds the objectives / feedback / telemetry sub-slots below, or
   * arbitrary side content. When none of `sidePanel`, `objectives`, `feedback`, or
   * `telemetry` are supplied, an on-brand placeholder is shown.
   */
  sidePanel?: ReactNode;
  /** Objectives sub-slot (rendered in the side rail above feedback). */
  objectives?: ReactNode;
  /** Live-feedback sub-slot (rendered in the side rail, middle). */
  feedback?: ReactNode;
  /** Telemetry sub-slot (rendered in the side rail, bottom). */
  telemetry?: ReactNode;
  /**
   * Optional toolbar (run / reset / step controls). Rendered as a sticky bar above
   * the two columns when provided; omitted entirely otherwise.
   */
  toolbar?: ReactNode;
  /** Accessible label for the stage region. Default "Simulation". */
  stageLabel?: string;
  /** Accessible label for the side rail region. Default "Simulation panel". */
  sidePanelLabel?: string;
}

// Token-class recipes (D1). No raw hex — every class is backed by a CSS variable via the
// Tailwind preset. The grid is single-column on narrow and a 2:1 stage/rail split on `lg`+.
// Animation, if any, is limited to the kit's rdx-anim-* classes (reduced-motion-safe).
const ROOT = 'flex w-full flex-col gap-4 p-4';

// Solid token surface + blur for the sticky bar — the panel color is var()-backed, so an
// /alpha modifier would not resolve (see Card.tsx); backdrop-blur supplies the depth.
const TOOLBAR =
  'sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-card border border-line ' +
  'bg-panel p-3 backdrop-blur-md';

const GRID = 'grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr] lg:items-start';

// The stage fills its column and reserves a tall min-height so the placeholder + a real
// renderer both have room to mount. `overflow-hidden` clips a full-bleed canvas to the radius.
const STAGE =
  'relative flex min-h-[360px] flex-col overflow-hidden rounded-panel ' +
  'border border-line bg-surface-4';

// The side rail stacks its sub-slots; on `lg`+ it sticks while the stage scrolls.
const SIDE_PANEL = 'flex min-h-0 flex-col gap-4 lg:sticky lg:top-4';

/**
 * SimStage — the sim runtime LAYOUT SHELL (D1 module-archetype template). A LAYOUT FRAME
 * ONLY: a main {stage} area where F5's sim renderer later mounts, a right {sidePanel}
 * (with objectives / feedback / telemetry sub-slots), and an optional {toolbar}. Two
 * columns on wide viewports, stacked on narrow. NO sim engine, NO scoring, NO state — that
 * is F5 / M3-5. Empty slots fall back to the kit's on-brand EmptyState placeholders.
 *
 * Accessible by construction: the two columns are real landmark `<section>`s with labels,
 * the toolbar is a `role="toolbar"` region, and nothing relies on color alone. Forwards its
 * ref + spreads ...rest, and merges an external className via cx.
 */
export const SimStage = forwardRef<HTMLDivElement, SimStageProps>(function SimStage(
  {
    stage,
    sidePanel,
    objectives,
    feedback,
    telemetry,
    toolbar,
    stageLabel = 'Simulation',
    sidePanelLabel = 'Simulation panel',
    className,
    ...rest
  },
  ref,
) {
  const hasSideContent =
    sidePanel != null || objectives != null || feedback != null || telemetry != null;

  return (
    <div ref={ref} className={cx(ROOT, className)} {...rest}>
      {toolbar != null ? (
        <div role="toolbar" aria-label="Simulation controls" className={TOOLBAR}>
          {toolbar}
        </div>
      ) : null}

      <div className={GRID}>
        <section aria-label={stageLabel} className={STAGE}>
          {stage != null ? (
            stage
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                className="w-full border-0 bg-transparent"
                title="Simulation stage"
                description="The sim renderer mounts here. The engine is wired up later — this is the runtime frame only."
              />
            </div>
          )}
        </section>

        <section aria-label={sidePanelLabel} className={SIDE_PANEL}>
          {hasSideContent ? (
            <>
              {objectives != null ? <div data-slot="objectives">{objectives}</div> : null}
              {feedback != null ? <div data-slot="feedback">{feedback}</div> : null}
              {telemetry != null ? <div data-slot="telemetry">{telemetry}</div> : null}
              {sidePanel != null ? <div data-slot="side-panel">{sidePanel}</div> : null}
            </>
          ) : (
            <Card variant="panel" data-slot="side-panel-placeholder">
              <EmptyState
                className="border-0 bg-transparent"
                title="Side panel"
                description="Objectives, live feedback, and telemetry render here while the sim runs."
              />
            </Card>
          )}
        </section>
      </div>
    </div>
  );
});
