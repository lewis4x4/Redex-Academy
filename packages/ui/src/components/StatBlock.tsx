import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';

export type StatBlockAlign = 'start' | 'end';

export interface StatBlockProps extends HTMLAttributes<HTMLDivElement> {
  /** The numeric/text value (e.g. "92%", "3"). Rendered font-bold text-stat. */
  value: ReactNode;
  /** The caption beneath the value (micro, tracked, uppercase, muted). */
  label: ReactNode;
  /** Accent the value in brand red-bright (the `.v.red` HUD variant). */
  accent?: boolean;
  /** Cross-axis alignment of the column. HUD stats are end-aligned (default). */
  align?: StatBlockAlign;
}

// Token-class recipes (D1 §5.12, matched to the prototype `.hud .stat`). No raw
// hex — every class is backed by a CSS variable via the Tailwind preset.
// `.hud .stat` is a tight (lh 1.05) flex column; `.v` = 800/17px, `.v.red` =
// red-bright; `.l` = 9px/2px-tracked uppercase muted.
const BASE = 'flex flex-col leading-[1.05]';

const ALIGN: Record<StatBlockAlign, string> = {
  start: 'items-start text-left',
  end: 'items-end text-right',
};

const LABEL = 'text-micro tracking-label uppercase text-ink-muted';

/**
 * HUD stat — a compact value + label pair (D1 §5.12). Colorblind-safe by
 * construction: the value never relies on color alone for meaning; `accent`
 * is a brand highlight, and the label always carries the textual meaning.
 * Renders a plain non-interactive `<div>` with the global type tokens.
 */
export const StatBlock = forwardRef<HTMLDivElement, StatBlockProps>(function StatBlock(
  { value, label, accent = false, align = 'end', className, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={cx(BASE, ALIGN[align], className)} {...rest}>
      <span className={cx('font-bold text-stat', accent && 'text-redex-bright')}>{value}</span>
      <span className={LABEL}>{label}</span>
    </div>
  );
});

export interface ScoreValueProps extends HTMLAttributes<HTMLDivElement> {
  /** The big score numeral (e.g. "92"). Rendered text-display font-display. */
  value: ReactNode;
  /** Optional trailing unit (e.g. "%", "pts") — body-lg, muted. */
  unit?: ReactNode;
  /** The caption beneath the score (micro, tracked, uppercase, muted). */
  label?: ReactNode;
  /** Cross-axis alignment of the column. Defaults to start. */
  align?: StatBlockAlign;
}

// Score-card variant (D1 §5.12): `.sc-val` 30px/900 + `.unit` 14px muted. The
// closest scale tokens are text-display (font-display = 900) + text-body-lg for
// the unit. Larger, display-weight presentation of the same value/label pair.
const SCORE_VALUE = 'inline-flex items-baseline gap-1 font-display text-display';

/**
 * ScoreValue — the larger, display-weight variant of {@link StatBlock} (D1
 * §5.12, the score-card `.sc-val` + `.unit`). Same colorblind-safe contract:
 * the unit and label carry textual meaning so the number is never color-only.
 */
export const ScoreValue = forwardRef<HTMLDivElement, ScoreValueProps>(function ScoreValue(
  { value, unit, label, align = 'start', className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx('flex flex-col leading-[1.05]', ALIGN[align], className)}
      {...rest}
    >
      <span className={SCORE_VALUE}>
        {value}
        {unit ? <span className="text-body-lg font-bold text-ink-muted">{unit}</span> : null}
      </span>
      {label ? <span className={LABEL}>{label}</span> : null}
    </div>
  );
});
