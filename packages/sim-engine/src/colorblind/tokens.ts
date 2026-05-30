/**
 * Colorblind-safe state tokens (invariant 7 / DRY_RUN red flag). State is NEVER
 * color alone: `shape` + `label_i18n` are load-bearing, `color_role` is advisory.
 * The framework supplies these defaults; a spec's `state_tokens` may override the
 * label/shape but the renderer always shows shape + text. One source of tokens so
 * the rich and 2D-fallback renderers (and every engine) are identical.
 */
import type { ColorblindSafeState } from '@redex/sim-schemas';

export type StateToken = ColorblindSafeState['token'];

export const DEFAULT_STATE_TOKENS: Record<StateToken, ColorblindSafeState> = {
  pass: {
    token: 'pass',
    shape: 'check',
    label_i18n: 'sim.common.state.pass',
    color_role: 'success',
  },
  fail: {
    token: 'fail',
    shape: 'cross',
    label_i18n: 'sim.common.state.fail',
    color_role: 'danger',
  },
  warn: {
    token: 'warn',
    shape: 'triangle',
    label_i18n: 'sim.common.state.warn',
    color_role: 'warning',
  },
  neutral: {
    token: 'neutral',
    shape: 'circle',
    label_i18n: 'sim.common.state.neutral',
    color_role: 'muted',
  },
  safety_veto: {
    token: 'safety_veto',
    shape: 'octagon',
    label_i18n: 'sim.common.state.safety_stop',
    color_role: 'danger',
  },
};

/** Resolve the token to render: a spec override (by token) wins; else the default. */
export function resolveStateToken(
  token: StateToken,
  overrides: readonly ColorblindSafeState[] = [],
): ColorblindSafeState {
  return overrides.find((s) => s.token === token) ?? DEFAULT_STATE_TOKENS[token];
}

/** The Unicode shape glyph rendered alongside the text label (never color alone). */
export const SHAPE_GLYPH: Record<ColorblindSafeState['shape'], string> = {
  check: '✓',
  cross: '✕',
  triangle: '▲',
  octagon: '⛔',
  circle: '●',
  square: '■',
  diamond: '◆',
};
