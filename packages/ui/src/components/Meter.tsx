import { forwardRef, type HTMLAttributes } from 'react';
import { cx } from '../cx';

/** Clamp an arbitrary number into the inclusive [0, 1] progress range. */
function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Render a 0..1 fraction as an integer percent string ("0".."100"). */
function toPercent(value: number): number {
  return Math.round(clamp01(value) * 100);
}

// ── ProgressBar ──────────────────────────────────────────────────────────────

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Completion fraction, 0..1 (clamped). */
  value: number;
  /** Accessible name for the progressbar (required for a labelled meter). */
  label?: string;
}

/**
 * Neutral completion bar (D1, §5.11 score-bar). Token-class only: a `bg-track`
 * trough with a `bg-grad-score` (red→red-bright) fill that animates its width
 * over `duration-meter`. `role="progressbar"` with aria-valuenow/min/max on a
 * 0..100 scale. Carries no status meaning, so it needs no color-blind pairing —
 * use <Meter> when the fill encodes ok/warn/over.
 */
export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(function ProgressBar(
  { value, label, className, ...rest },
  ref,
) {
  const pct = toPercent(value);
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cx('h-2 w-full overflow-hidden rounded bg-track', className)}
      {...rest}
    >
      <div
        className="h-full rounded bg-grad-score transition-[width] duration-meter ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
});

// ── Meter (budget) ─────────────────────────────────────────────────────────────

export type MeterTone = 'ok' | 'warn' | 'over';

export interface MeterProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Fill fraction, 0..1 (clamped). */
  value: number;
  /**
   * Budget tone. Drives the fill color AND the spoken/shown tone word, so the
   * status is never carried by color alone (green=ok / amber=warn / red=over).
   */
  tone: MeterTone;
  /**
   * Centered overlay text. Defaults to the percent (e.g. "82%"). Always rendered
   * so a colorblind user reads the numeric value, not just the fill hue.
   */
  label?: string;
  /** Accessible name for the meter (e.g. "PoE power budget"). */
  ariaLabel?: string;
}

// Token-class recipes (D1 §5.11 budget-meter). Solid brand tokens — no raw hex,
// no raw rgba — keyed by tone. The fill color is doubled by the TONE_WORD text.
const TONE_FILL: Record<MeterTone, string> = {
  ok: 'bg-green',
  warn: 'bg-amber',
  over: 'bg-redex',
};

const TONE_WORD: Record<MeterTone, string> = {
  ok: 'OK',
  warn: 'Near limit',
  over: 'Over budget',
};

/**
 * Budget meter (D1, §5.11). green → amber → red by the explicit `tone` prop
 * (ok | warn | over) rather than an implicit threshold, so the caller owns the
 * verdict. Colorblind-safe by construction: the centered label shows the numeric
 * value and the tone word is exposed to assistive tech via aria — color is never
 * the sole signal. `role="meter"` with aria-valuenow/min/max on a 0..100 scale.
 */
export const Meter = forwardRef<HTMLDivElement, MeterProps>(function Meter(
  { value, tone, label, ariaLabel, className, ...rest },
  ref,
) {
  const pct = toPercent(value);
  const text = label ?? `${pct}%`;
  const toneWord = TONE_WORD[tone];
  return (
    <div
      ref={ref}
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel ? `${ariaLabel}: ${toneWord}` : toneWord}
      className={cx(
        'relative h-[26px] w-full overflow-hidden rounded-mark border border-line bg-surface-2',
        className,
      )}
      {...rest}
    >
      <div
        className={cx(
          'h-full rounded-l-[7px] transition-[width,background-color] duration-meter ease-out',
          TONE_FILL[tone],
        )}
        style={{ width: `${pct}%` }}
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {/* The numeric value rides a small dark pill so white text clears WCAG AA
            contrast on ANY fill hue (green/amber/red), not just the dark trough —
            axe reads the backing color, and a drop-shadow alone does not satisfy it. */}
        <span className="rounded-pill bg-canvas px-2 py-0.5 text-caption font-bold text-white">
          {text}
        </span>
      </span>
    </div>
  );
});

// ── ProgressDots ───────────────────────────────────────────────────────────────

export type ProgressDotState = 'done' | 'fail' | 'current' | 'todo';

export interface ProgressDotsProps extends HTMLAttributes<HTMLOListElement> {
  /** Ordered pip states, one per step. */
  steps: ProgressDotState[];
  /** Accessible name for the step list (e.g. "Scenario progress"). */
  label?: string;
}

// Each pip pairs color with a glyph + aria-label so state is colorblind-safe:
// done = check, fail = cross, current = ring, todo = empty — never color alone.
const DOT_STYLE: Record<ProgressDotState, string> = {
  done: 'bg-green text-canvas border-green',
  fail: 'bg-state-fail text-white border-state-fail',
  current: 'bg-redex-bright text-white border-redex-bright shadow-glow',
  todo: 'bg-surface-2 text-ink-dim border-surface-1',
};

const DOT_GLYPH: Record<ProgressDotState, string> = {
  done: '✓', // ✓
  fail: '✕', // ✕
  current: '●', // ●
  todo: '○', // ○
};

const DOT_WORD: Record<ProgressDotState, string> = {
  done: 'done',
  fail: 'failed',
  current: 'current',
  todo: 'not started',
};

/**
 * Step pips (D1, §5.11 progress-dots). done / fail / current / todo. Rendered as
 * an ordered list so the count + position are exposed to assistive tech; each pip
 * carries a glyph + aria-label in addition to its color, so the state survives a
 * monochrome / colorblind reading (shape + text + color, never color alone).
 */
export const ProgressDots = forwardRef<HTMLOListElement, ProgressDotsProps>(function ProgressDots(
  { steps, label, className, ...rest },
  ref,
) {
  return (
    <ol
      ref={ref}
      aria-label={label}
      className={cx('flex list-none items-center gap-2 p-0', className)}
      {...rest}
    >
      {steps.map((state, i) => (
        <li
          // pips are positional with no stable id, so the index is the key
          key={i}
          aria-label={`Step ${i + 1}: ${DOT_WORD[state]}`}
          className={cx(
            'flex h-[18px] w-[18px] items-center justify-center rounded-pill border text-micro font-bold transition-all duration-nav ease-out',
            DOT_STYLE[state],
          )}
        >
          <span aria-hidden="true">{DOT_GLYPH[state]}</span>
        </li>
      ))}
    </ol>
  );
});
