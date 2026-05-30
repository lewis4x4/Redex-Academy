import { forwardRef, type HTMLAttributes } from 'react';
import { cx } from '../cx';

export interface PipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'aria-label'> {
  /** Whether this badge slot has been earned. Earned → red fill + glow + ✓ glyph. */
  earned?: boolean;
  /**
   * Human label for the thing this pip represents (e.g. a badge/module name).
   * Combined with the earned/locked state into the rendered aria-label so the
   * status is announced as text — never communicated by color alone.
   */
  label: string;
}

// Token-class recipes (D1 §5.13, matched to the prototype `.badge-pips .pip`). No
// raw hex — every class is backed by a CSS variable via the Tailwind preset. An
// 18px circle with a 2px `--surface-1` ring; the default fill is the neutral track,
// the `earned` fill is brand red + the tight earned glow, and the ✓ glyph is the
// colorblind-safe shape cue that distinguishes earned from locked without hue.
const BASE =
  'inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-pill ' +
  'border-2 border-surface-1 text-micro leading-none transition-all duration-hover';

const EARNED = 'bg-redex text-white shadow-glow';
const LOCKED = 'bg-track text-ink-dim';

/**
 * Pip — a single badge slot (D1 §5.13). Colorblind-safe by construction: the
 * earned state pairs the red fill with a ✓ glyph (shape) and an aria-label that
 * states "earned" vs. "locked" in words, so meaning never rests on color alone
 * (CODING_STANDARDS §9). Renders a non-interactive `<span>` with `role="img"`.
 */
export const Pip = forwardRef<HTMLSpanElement, PipProps>(function Pip(
  { earned = false, label, className, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      role="img"
      aria-label={`${label}: ${earned ? 'earned' : 'locked'}`}
      className={cx(BASE, earned ? EARNED : LOCKED, className)}
      {...rest}
    >
      {earned ? (
        <span aria-hidden="true" className="leading-none">
          ✓
        </span>
      ) : null}
    </span>
  );
});

export interface PipRowProps extends HTMLAttributes<HTMLSpanElement> {
  /**
   * Accessible name for the group of pips (e.g. "Foundations badges"). Rendered
   * as the group's aria-label; each child Pip still announces its own state.
   */
  label: string;
}

// The `.badge-pips` row: pips overlap by 6px (-ml-1.5) so the stack reads as one
// cluster, while the first pip sits flush (`first:ml-0`). The negative margin is
// applied to the children via the group selector so callers just drop <Pip/>s in.
const ROW = 'inline-flex items-center [&>*]:-ml-1.5 [&>*:first-child]:ml-0';

/**
 * PipRow — the overlapping cluster of {@link Pip}s (D1 §5.13 `.badge-pips`).
 * Exposes the group as `role="group"` with an aria-label; every child Pip keeps
 * its own earned/locked text label, so the whole stack is colorblind-safe.
 */
export const PipRow = forwardRef<HTMLSpanElement, PipRowProps>(function PipRow(
  { label, className, children, ...rest },
  ref,
) {
  return (
    <span ref={ref} role="group" aria-label={label} className={cx(ROW, className)} {...rest}>
      {children}
    </span>
  );
});
