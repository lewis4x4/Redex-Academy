import type { ColorblindSafeState } from '@redex/sim-schemas';
import type { ReactElement } from 'react';
import { SHAPE_GLYPH } from './tokens';

const COLOR_CLASS: Record<NonNullable<ColorblindSafeState['color_role']>, string> = {
  success: 'text-state-pass',
  danger: 'text-state-fail',
  warning: 'text-state-pending',
  info: 'text-ink-soft',
  muted: 'text-ink-muted',
};

export interface StateBadgeProps {
  state: ColorblindSafeState;
  /** Pre-resolved (i18n) text label — ALWAYS rendered (never icon/color alone). */
  label: string;
}

/**
 * Colorblind-safe state indicator (invariant 7). Encodes state with SHAPE (glyph)
 * + TEXT + color together; color is NEVER the sole carrier. The glyph is
 * aria-hidden (decorative); the text label is the accessible name. data-token /
 * data-shape let tests assert non-color encoding.
 */
export function StateBadge({ state, label }: StateBadgeProps): ReactElement {
  const colorClass = state.color_role ? COLOR_CLASS[state.color_role] : 'text-ink-soft';
  return (
    <span
      role="status"
      data-token={state.token}
      data-shape={state.shape}
      className={`inline-flex items-center gap-1 font-semibold ${colorClass}`}
    >
      <span aria-hidden="true">{SHAPE_GLYPH[state.shape]}</span>
      <span>{label}</span>
    </span>
  );
}
