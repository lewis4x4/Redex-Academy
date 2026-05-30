import type { ReactElement } from 'react';

export type VerdictKind = 'pass' | 'fail' | 'safety_veto' | 'pending';

interface Presentation {
  label: string;
  /** Non-color shape carrier (rendered aria-hidden alongside the text label). */
  symbol: string;
  /** Hue carried by the tint pill + the symbol glyph (the colorblind-safe color cue). */
  symbolClassName: string;
  /** Translucent verdict tint pill (hue@.14 bg + hue@.5 edge) the badge rides on. */
  pillClassName: string;
}

// The label text is white (clears WCAG AA on the dark canvas — the dark state hues
// #b3261e/#7a1fa2 as text did not), while the verdict HUE is carried by the tint
// pill + the colored shape glyph. State stays shape + text + color, never color
// alone. Token classes only — no raw hex.
const PRESENTATION: Record<VerdictKind, Presentation> = {
  pass: {
    label: 'Pass',
    symbol: '✓',
    symbolClassName: 'text-state-pass',
    pillClassName: 'bg-green-tint border-green-edge',
  },
  fail: {
    label: 'Fail',
    symbol: '✕',
    symbolClassName: 'text-redex-bright',
    pillClassName: 'bg-red-tint border-red-edge',
  },
  safety_veto: {
    label: 'Safety veto',
    symbol: '⚠',
    symbolClassName: 'text-state-veto',
    pillClassName: 'bg-veto-tint border-veto-edge',
  },
  pending: {
    label: 'Pending',
    symbol: '…',
    symbolClassName: 'text-state-pending',
    pillClassName: 'bg-amber-tint border-amber-edge',
  },
};

export interface StatusBadgeProps {
  kind: VerdictKind;
  /** Optional label override; defaults to a human-readable verdict name. */
  label?: string;
}

/**
 * Colorblind-safe status indicator. Encodes state with SHAPE (symbol) + TEXT +
 * color together — color is NEVER the sole carrier of meaning
 * (CODING_STANDARDS.md §9, CLAUDE.md a11y conventions). Every sim Verdict /
 * sign-off surface renders state through this primitive.
 */
export function StatusBadge({ kind, label }: StatusBadgeProps): ReactElement {
  const p = PRESENTATION[kind];
  return (
    <span
      role="status"
      data-kind={kind}
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-white ${p.pillClassName}`}
    >
      <span aria-hidden="true" className={p.symbolClassName}>
        {p.symbol}
      </span>
      <span>{label ?? p.label}</span>
    </span>
  );
}
