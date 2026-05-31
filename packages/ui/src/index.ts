// @redex/ui — the Redex Academy design system (D1). The single consumer contract
// every screen + module builds on: design tokens, the component kit, the app shell,
// and the module-archetype templates. Dark + Redex-red; colorblind-safe; WCAG AA.
// No screen hardcodes its own look — everything renders on these tokens/components.

export { cx } from './cx';
export { useFocusTrap } from './useFocusTrap';
export * as tokens from './tokens';

// ── Component kit ───────────────────────────────────────────────────────────
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './components/Button';
export * from './components/Card';
export * from './components/NavPill';
export * from './components/Chip';
export * from './components/Tag';
export * from './components/Tooltip';
export * from './components/Modal';
export * from './components/SlideOver';
export * from './components/Toast';
export * from './components/Meter';
export * from './components/StatBlock';
export * from './components/Pip';
export * from './components/TrophyMedal';
export * from './components/Icon';
export * from './components/Input';
export * from './components/Toggle';
export * from './components/States';
export * from './components/Callout';
export * from './components/Checklist';

// Folded in from F1 — the colorblind-safe verdict indicator.
export { StatusBadge } from './StatusBadge';
export type { StatusBadgeProps, VerdictKind } from './StatusBadge';

// ── App shell + module-archetype templates ──────────────────────────────────
export * from './shell';
export * from './templates';
