import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';
import { Card } from '../components/Card';
import { EmptyState } from '../components/States';

// ── Node-state swatch model (the default legend) ─────────────────────────────
// The skill-map node states (locked → available → in-progress → mastered → boss).
// The DATA + gating that decides a node's state is M1 — this is purely the legend
// FRAME. Each row is colorblind-safe by construction: meaning is carried by a
// distinct SHAPE + the label text, never the token hue alone (invariant 7).
export type ConstellationNodeState = 'locked' | 'available' | 'in-progress' | 'mastered' | 'boss';

interface NodeStateSwatch {
  state: ConstellationNodeState;
  /** Human label rendered beside the shape. */
  label: string;
  /** A token-class shape glyph — the colorblind-safe carrier of meaning. */
  swatch: ReactNode;
}

// Token-class-only swatch shapes. Each is a small square/diamond/ring/star so the
// rows are distinguishable WITHOUT relying on color (shape + text + color).
const SWATCH_BASE = 'inline-block h-3.5 w-3.5 shrink-0';

const DEFAULT_NODE_STATES: readonly NodeStateSwatch[] = [
  {
    // Locked: hollow square, muted locked stroke — clearly "not yet".
    state: 'locked',
    label: 'Locked',
    swatch: <span className={cx(SWATCH_BASE, 'rounded-mark border-2 border-domain-locked')} />,
  },
  {
    // Available: hollow red-edged square — an open node you can enter.
    state: 'available',
    label: 'Available',
    swatch: <span className={cx(SWATCH_BASE, 'rounded-mark border-2 border-redex')} />,
  },
  {
    // In-progress: red-tint filled square w/ red edge — work underway.
    state: 'in-progress',
    label: 'In progress',
    swatch: <span className={cx(SWATCH_BASE, 'rounded-mark border border-red-edge bg-red-tint')} />,
  },
  {
    // Mastered: solid gold diamond (rotated square) — a distinct shape, not just a hue.
    state: 'mastered',
    label: 'Mastered',
    swatch: <span className={cx(SWATCH_BASE, 'rotate-45 bg-gold')} />,
  },
  {
    // Boss: filled red CTA ring — the domain capstone marker.
    state: 'boss',
    label: 'Boss',
    swatch: <span className={cx(SWATCH_BASE, 'rounded-full border-2 border-redex bg-grad-cta')} />,
  },
];

/** The default legend body: one colorblind-safe row per node state (shape + text). */
function DefaultLegend(): ReactNode {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-eyebrow font-label uppercase tracking-eyebrow text-redex-bright">
        Node states
      </p>
      <ul className="flex flex-col gap-1.5">
        {DEFAULT_NODE_STATES.map(({ state, label, swatch }) => (
          <li key={state} className="flex items-center gap-2">
            <span aria-hidden="true" className="flex h-3.5 w-3.5 items-center justify-center">
              {swatch}
            </span>
            <span className="text-label text-ink-soft">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface ConstellationFrameProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * The pan/zoom stage content — the caller drops the skill-map `<svg>` here later
   * (M1). Rendered full-bleed over the dark canvas. When omitted, an on-brand
   * EmptyState placeholder fills the stage.
   */
  stage?: ReactNode;
  /**
   * Top lens-panel slot (e.g. domain/persona <Chip/>s). Rendered in a glass panel
   * docked top-left over the stage. The filtering BEHAVIOR is M1 — this is the frame.
   */
  lensPanel?: ReactNode;
  /**
   * Bottom-left legend slot. Defaults to the node-state swatch legend
   * (locked/available/in-progress/mastered/boss). Pass `null` to hide it entirely.
   */
  legend?: ReactNode;
  /** Accessible label for the stage region (default "Skill constellation"). */
  stageLabel?: string;
}

// The stage is a relative full-bleed surface over the dark canvas. The `stage` slot
// (the caller's <svg>) fills inset-0; the lens + legend float above it in glass
// panels. NO pan/zoom behavior lives here — just the frame + named slots.
const STAGE_BASE = 'relative h-full w-full overflow-hidden bg-canvas';

// Glass overlay panels (translucent surface + blur + line border) for lens/legend.
const GLASS_PANEL = 'border-line shadow-card';

/**
 * ConstellationFrame — the SVG pan/zoom STAGE shell for the skill map (D1; the map
 * DATA + pan/zoom/gating logic is M1). A relative full-bleed stage over the dark
 * canvas with three named slots:
 *
 *  • `stage`     — the caller's `<svg>` skill map, full-bleed (EmptyState if absent).
 *  • `lensPanel` — top-left glass panel for domain/persona filter Chips.
 *  • `legend`    — bottom-left glass panel; defaults to the colorblind-safe
 *                  node-state swatch legend (shape + text, never color alone).
 *
 * This is a LAYOUT SHELL ONLY: no pan, no zoom, no data, no state. Forwards its ref
 * and spreads ...rest; merges an external className via cx. Token classes only.
 */
export const ConstellationFrame = forwardRef<HTMLDivElement, ConstellationFrameProps>(
  function ConstellationFrame(
    { stage, lensPanel, legend, stageLabel = 'Skill constellation', className, ...rest },
    ref,
  ) {
    // `undefined` ⇒ default legend; explicit `null` ⇒ legend hidden.
    const legendContent = legend === undefined ? <DefaultLegend /> : legend;

    return (
      <div ref={ref} className={cx(STAGE_BASE, className)} {...rest}>
        {/* Stage layer — the caller's <svg> renders here (M1), or a placeholder. */}
        <div role="region" aria-label={stageLabel} className="absolute inset-0" data-slot="stage">
          {stage != null ? (
            stage
          ) : (
            <div className="flex h-full w-full items-center justify-center p-8">
              <EmptyState
                title="Skill map coming online"
                description="Your constellation of competencies will render here once the catalog loads."
              />
            </div>
          )}
        </div>

        {/* Lens panel — top-left glass overlay for domain/persona Chips. */}
        {lensPanel != null ? (
          <Card
            variant="glass"
            padding="sm"
            data-slot="lens-panel"
            className={cx(
              'pointer-events-auto absolute left-4 top-4 max-w-[min(90%,420px)]',
              GLASS_PANEL,
            )}
          >
            {lensPanel}
          </Card>
        ) : null}

        {/* Legend — bottom-left glass overlay (default node-state swatches). */}
        {legendContent != null ? (
          <Card
            variant="glass"
            padding="sm"
            data-slot="legend"
            className={cx(
              'pointer-events-auto absolute bottom-4 left-4 max-w-[min(90%,260px)]',
              GLASS_PANEL,
            )}
          >
            {legendContent}
          </Card>
        ) : null}
      </div>
    );
  },
);
