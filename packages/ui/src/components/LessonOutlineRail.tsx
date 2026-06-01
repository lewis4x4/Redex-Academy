import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';

export interface LessonOutlineStep {
  /** Stable key for the step (e.g. the step ordinal or slug). */
  id: string;
  /** The step's title (the rail row's primary line). */
  label: ReactNode;
  /** Optional sub-line under the label (the rail row's caption). */
  sub?: ReactNode;
}

export interface LessonOutlineRailProps extends Omit<HTMLAttributes<HTMLElement>, 'onSelect'> {
  /** The ordered steps to render as rail rows. */
  steps: LessonOutlineStep[];
  /** The active step index (0-based). */
  current: number;
  /** The furthest step the learner has reached; rows at or before it are clickable. */
  furthestReached: number;
  /** Jump to a step. Only invoked for a reachable (i ≤ furthestReached) row. */
  onStep: (index: number) => void;
  /** Accessible name for the rail nav. Defaults to "In this lesson". */
  ariaLabel?: string;
  /** Eyebrow heading shown above the list (the mockup's .rhead). */
  heading?: ReactNode;
}

// State derivation: i < current = done (green ✓), i === current = active (red dot +
// aria-current), i > current = todo (outlined number). Each carries NUMBER + GLYPH +
// COLOR + an aria-label so the state survives a monochrome / colorblind reading
// (CODING_STANDARDS §9 — never color alone). Token classes only; no raw hex.
type StepState = 'done' | 'active' | 'todo';

const DOT_STYLE: Record<StepState, string> = {
  done: 'bg-green text-canvas border-green',
  active: 'bg-redex text-white border-redex',
  todo: 'bg-transparent text-ink-muted border-line',
};

const STATE_WORD: Record<StepState, string> = {
  done: 'done',
  active: 'current',
  todo: 'not started',
};

/**
 * LessonOutlineRail — the lesson's left outline rail (the mockup's 236px `.rail`).
 * A semantic `<nav><ol><li><button>` (NOT a NavPill — the rail must announce the
 * step COUNT and each step's POSITION to assistive tech). Each row's state is carried
 * by a number badge + a glyph + a token color + an aria-label, never color alone, so
 * it is colorblind-safe. Completed + the current step are clickable (≤ furthestReached);
 * steps ahead of the learner are disabled. Width is owned by the parent grid column —
 * this component is width-agnostic. Reduced-motion-safe (transition is duration-token,
 * disabled under prefers-reduced-motion by the kit's global guard).
 */
export const LessonOutlineRail = forwardRef<HTMLElement, LessonOutlineRailProps>(
  function LessonOutlineRail(
    {
      steps,
      current,
      furthestReached,
      onStep,
      ariaLabel = 'In this lesson',
      heading,
      className,
      ...rest
    },
    ref,
  ) {
    return (
      <nav
        ref={ref}
        aria-label={typeof ariaLabel === 'string' ? ariaLabel : undefined}
        className={cx('rounded-card border border-line bg-panel p-2', className)}
        {...rest}
      >
        <p className="px-2 pb-1 pt-1 text-eyebrow font-label uppercase tracking-eyebrow text-ink-muted">
          {heading ?? ariaLabel}
        </p>
        <ol className="m-0 flex list-none flex-col gap-1 p-0">
          {steps.map((step, i) => {
            const state: StepState = i < current ? 'done' : i === current ? 'active' : 'todo';
            const reachable = i <= furthestReached;
            const glyph = state === 'done' ? '✓' : String(i + 1);
            return (
              <li key={step.id}>
                <button
                  type="button"
                  data-step={i + 1}
                  data-state={state}
                  aria-current={state === 'active' ? 'page' : undefined}
                  disabled={!reachable}
                  onClick={() => {
                    if (reachable) onStep(i);
                  }}
                  className={cx(
                    'flex w-full items-start gap-2 rounded-control px-2 py-2 text-left transition-all duration-nav ease-out',
                    'disabled:cursor-not-allowed',
                    state === 'active' ? 'bg-red-tint text-white' : 'text-ink',
                    reachable && state !== 'active' && 'hover:bg-surface-hover',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border text-label font-bold leading-none',
                      DOT_STYLE[state],
                    )}
                  >
                    {glyph}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-body font-nav">
                      <span className="sr-only">{`Step ${i + 1}, ${STATE_WORD[state]}: `}</span>
                      {step.label}
                    </span>
                    {step.sub != null ? (
                      <span className="text-caption text-ink-muted">{step.sub}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  },
);
