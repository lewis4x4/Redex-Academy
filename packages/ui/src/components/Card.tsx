import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';

export type CardVariant = 'panel' | 'raised' | 'gradient' | 'glass';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

// `title` is widened to ReactNode for the header slot, so the native string-typed
// `title` attribute (tooltip) is omitted from the base to avoid the type collision.
export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Surface treatment (D1 §5.3). `glass` is translucent + backdrop-blur for overlays. */
  variant?: CardVariant;
  /** Inner padding rhythm. Defaults to `md` (16px) — the prototype's dominant card pad. */
  padding?: CardPadding;
  /** Optional header eyebrow (uppercase micro-label rendered above the title). */
  eyebrow?: ReactNode;
  /** Optional header title. Rendered in the card's heading slot when provided. */
  title?: ReactNode;
}

// Token-class recipes (D1 §5.3 — Card/Panel). No raw hex/rgba: every class is backed
// by a CSS variable via the Tailwind preset. The prototype has no single `.card`; this
// consolidates cell/score-card/scenario-card/glass into one primitive (GAP §7.10).
const BASE = 'border border-line text-white transition-all duration-hover';

const VARIANT: Record<CardVariant, string> = {
  // Default panel surface — the data-cell / generic card.
  panel: 'bg-panel rounded-card',
  // Raised feedback/score surface.
  raised: 'bg-panel-2 rounded-card shadow-card',
  // 135° dark gradient panel (e.g. bp-card / drawer body).
  gradient: 'bg-grad-panel rounded-panel',
  // Translucent glass for legend/lens overlays — token surface + blur, no raw rgba.
  // Uses the darkest surface token (no opacity modifier: these colors are var()-backed,
  // so a /alpha suffix would not resolve); backdrop-blur supplies the glass depth.
  glass: 'bg-surface-5 backdrop-blur-md rounded-card',
};

const PADDING: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

/**
 * Card / Panel primitive (D1 §5.3). A `div` wrapper that consolidates the prototype's
 * duplicated surface patterns into one component with surface/gradient/glass variants.
 * When `title`/`eyebrow` are supplied it renders a header slot; the heading uses a
 * native `<h3>` so the document outline stays correct and the surface is screen-reader
 * navigable. Forwards its ref + spreads ...rest, and merges an external className via cx.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'panel', padding = 'md', eyebrow, title, className, children, ...rest },
  ref,
) {
  const hasHeader = eyebrow != null || title != null;
  return (
    <div ref={ref} className={cx(BASE, VARIANT[variant], PADDING[padding], className)} {...rest}>
      {hasHeader ? (
        <div className="mb-3 flex flex-col gap-1">
          {eyebrow != null ? (
            <span className="text-eyebrow font-label uppercase tracking-eyebrow text-redex-bright">
              {eyebrow}
            </span>
          ) : null}
          {title != null ? (
            <h3 className="text-subtitle font-bold tracking-tighttitle text-white">{title}</h3>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
});
