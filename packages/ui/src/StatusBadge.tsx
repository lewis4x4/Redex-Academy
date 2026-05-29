import type { ReactElement } from 'react';

export type VerdictKind = 'pass' | 'fail' | 'safety_veto' | 'pending';

interface Presentation {
  label: string;
  /** Non-color shape carrier (rendered aria-hidden alongside the text label). */
  symbol: string;
  className: string;
}

const PRESENTATION: Record<VerdictKind, Presentation> = {
  pass: { label: 'Pass', symbol: '✓', className: 'text-state-pass' },
  fail: { label: 'Fail', symbol: '✕', className: 'text-state-fail' },
  safety_veto: { label: 'Safety veto', symbol: '⚠', className: 'text-state-veto' },
  pending: { label: 'Pending', symbol: '…', className: 'text-state-pending' },
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
      className={`inline-flex items-center gap-1 ${p.className}`}
    >
      <span aria-hidden="true">{p.symbol}</span>
      <span>{label ?? p.label}</span>
    </span>
  );
}
