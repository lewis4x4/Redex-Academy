import { cx } from '@redex/ui';
import type { ReactElement } from 'react';
import type { ProgressDotState } from '@redex/ui';

export interface CourseRailUnit {
  id: string;
  /** The unit's display label (its title) — spoken in the per-unit aria-label. */
  label: string;
  state: ProgressDotState;
}

// Colorblind-safe: each pip pairs colour with a glyph + a per-unit aria-label (the unit
// title + spoken state) — never colour alone. Mirrors the @redex/ui ProgressDots
// tokens, but carries the UNIT NAME in the label (the course rail, not a generic step).
const DOT_STYLE: Record<ProgressDotState, string> = {
  done: 'bg-green text-canvas border-green',
  fail: 'bg-state-fail text-white border-state-fail',
  current: 'bg-redex-bright text-white border-redex-bright shadow-glow',
  todo: 'bg-surface-2 text-ink-dim border-surface-1',
};
const DOT_GLYPH: Record<ProgressDotState, string> = {
  done: '✓',
  fail: '✕',
  current: '●',
  todo: '○',
};
const DOT_WORD: Record<ProgressDotState, string> = {
  done: 'passed',
  fail: 'failed',
  current: 'current',
  todo: 'not started',
};

export interface CourseProgressRailProps {
  units: CourseRailUnit[];
  /** Accessible name for the whole rail (e.g. "Course progress"). */
  label: string;
  className?: string;
}

/**
 * The course-player's per-unit progress rail. A semantic <nav><ol><li> so assistive
 * tech announces the unit COUNT + each unit's name + state (e.g. "Unit 2 of 5: Is This
 * Egress Install Code-Compliant? — current"). Colorblind-safe by construction (glyph +
 * text + colour, never colour alone). Read-only (the player advances on server verdicts).
 */
export function CourseProgressRail({
  units,
  label,
  className,
}: CourseProgressRailProps): ReactElement {
  return (
    <nav aria-label={label} data-testid="course-rail" className={className}>
      <ol className="flex flex-wrap items-center gap-2 p-0">
        {units.map((u, i) => (
          <li
            key={u.id}
            data-unit={u.id}
            data-state={u.state}
            aria-label={`Unit ${i + 1} of ${units.length}: ${u.label} — ${DOT_WORD[u.state]}`}
            className={cx(
              'flex h-[20px] w-[20px] items-center justify-center rounded-pill border text-micro font-mono transition-all duration-nav ease-out',
              DOT_STYLE[u.state],
            )}
          >
            <span aria-hidden="true">{DOT_GLYPH[u.state]}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
