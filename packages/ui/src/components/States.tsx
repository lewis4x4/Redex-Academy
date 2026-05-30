import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';

export type StateRadius = 'none' | 'mark' | 'control' | 'card' | 'panel' | 'pill';

// Radius tokens (D1 §3.2) → Tailwind classes. `none` = sharp (e.g. a text-line skeleton).
const RADIUS: Record<StateRadius, string> = {
  none: 'rounded-none',
  mark: 'rounded-mark',
  control: 'rounded-control',
  card: 'rounded-card',
  panel: 'rounded-panel',
  pill: 'rounded-pill',
};

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Box width — any CSS length (e.g. `'100%'`, `120`, `'8rem'`). Default `'100%'`. */
  width?: number | string;
  /** Box height — any CSS length. Default `'1rem'` (a text-line placeholder). */
  height?: number | string;
  /** Corner radius token. Default `mark` (8px). */
  rounded?: StateRadius;
}

// Token-class recipe (D1 GAP §7.6 — the prototype lacks a shimmer; authored on-brand).
// Base fill = surface-2; the sweep moves a line-colored band across it via a token-only
// gradient. The shimmer is gated behind reduced motion (motion-reduce:animate-none) so it
// calms to a static block under the OS "reduce motion" setting (WCAG 2.3.3 / invariant 7).
const SKELETON_BASE =
  'block bg-surface-2 bg-gradient-to-r from-surface-2 via-line to-surface-2 bg-[length:200%_100%] ' +
  'animate-pulse motion-reduce:animate-none';

/**
 * Skeleton — a shimmer placeholder for loading content (D1 GAP §7.6). Purely decorative:
 * rendered `aria-hidden` so screen readers skip it (announce loading at the region level
 * instead). The animated sweep auto-disables under prefers-reduced-motion. Sizing is
 * inline (arbitrary lengths), radius is a token. Forwards its ref + spreads ...rest.
 */
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { width = '100%', height = '1rem', rounded = 'mark', className, style, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cx(SKELETON_BASE, RADIUS[rounded], className)}
      style={{ width, height, ...style }}
      {...rest}
    />
  );
});

// `title` is widened to ReactNode for the headline slot, so the native string-typed
// `title` attribute (tooltip) is omitted from the base to avoid the type collision.
export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Optional decorative icon/illustration slot, centered above the title (aria-hidden). */
  icon?: ReactNode;
  /** Short headline describing the empty condition. */
  title: ReactNode;
  /** Muted supporting copy (optional). */
  description?: ReactNode;
  /** Optional call-to-action (e.g. a <Button/>), centered below the copy. */
  action?: ReactNode;
}

// Shared centered-message layout for Empty + Error. Token classes only — no raw hex.
const MESSAGE_LAYOUT =
  'flex flex-col items-center justify-center text-center gap-3 px-6 py-10 ' +
  'border border-line rounded-card';

/**
 * EmptyState — a formalized empty/zero-data placeholder (D1 GAP §7.7). Centered icon slot
 * + title + muted description + optional action. Announced politely via `role="status"`
 * (it reports a benign "nothing here" condition, not an error). Colorblind-safe: meaning
 * is carried by the icon + text, never color alone. Forwards its ref + spreads ...rest.
 */
export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  { icon, title, description, action, className, ...rest },
  ref,
) {
  return (
    <div ref={ref} role="status" className={cx(MESSAGE_LAYOUT, 'bg-panel', className)} {...rest}>
      {icon != null ? (
        <span aria-hidden="true" className="inline-flex text-ink-dim">
          {icon}
        </span>
      ) : null}
      <p className="text-subtitle font-bold tracking-tighttitle text-white">{title}</p>
      {description != null ? (
        <p className="max-w-[42ch] text-body text-ink-muted">{description}</p>
      ) : null}
      {action != null ? <div className="mt-1 inline-flex">{action}</div> : null}
    </div>
  );
});

// `title` is widened to ReactNode for the headline slot, so the native string-typed
// `title` attribute (tooltip) is omitted from the base to avoid the type collision.
export interface ErrorStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * Custom icon slot. Defaults to a colorblind-safe warning glyph (⚠ + amber), so the
   * error reads without relying on hue alone.
   */
  icon?: ReactNode;
  /** Short headline describing what failed. Defaults to "Something went wrong". */
  title?: ReactNode;
  /** Muted supporting copy explaining the failure / next step (optional). */
  description?: ReactNode;
  /** Retry handler. When provided, renders the default retry control. */
  onRetry?: () => void;
  /** Label for the default retry control. Default "Retry". */
  retryLabel?: string;
  /**
   * Custom action node, rendered instead of the default retry control (e.g. a styled
   * <Button/>). Takes precedence over `onRetry`/`retryLabel`.
   */
  action?: ReactNode;
}

// Default warn glyph — paired with text + amber so the state is never color-only (§5.6/§5.15).
const WARN_GLYPH = (
  <span aria-hidden="true" className="text-stat leading-none text-amber">
    ⚠
  </span>
);

/**
 * ErrorState — an error/retry placeholder (D1 GAP §7.7, like EmptyState but for failures).
 * Carries `role="alert"` so it is announced assertively. Colorblind-safe by construction:
 * the default warn glyph (⚠) + the title text convey the failure independent of the amber
 * hue. A native <button> retry is keyboard-operable with the global focus ring; pass a
 * custom `action` to override. Forwards its ref + spreads ...rest.
 */
export const ErrorState = forwardRef<HTMLDivElement, ErrorStateProps>(function ErrorState(
  {
    icon,
    title = 'Something went wrong',
    description,
    onRetry,
    retryLabel = 'Retry',
    action,
    className,
    ...rest
  },
  ref,
) {
  return (
    <div ref={ref} role="alert" className={cx(MESSAGE_LAYOUT, 'bg-panel', className)} {...rest}>
      <span className="inline-flex">{icon != null ? icon : WARN_GLYPH}</span>
      <p className="text-subtitle font-bold tracking-tighttitle text-white">{title}</p>
      {description != null ? (
        <p className="max-w-[42ch] text-body text-ink-muted">{description}</p>
      ) : null}
      {action != null ? (
        <div className="mt-1 inline-flex">{action}</div>
      ) : onRetry != null ? (
        <button
          type="button"
          onClick={onRetry}
          className={cx(
            'mt-1 inline-flex items-center justify-center gap-2 rounded-[10px] px-[18px] py-[11px]',
            'font-label text-body text-white bg-surface-hover border border-line',
            'transition-all duration-hover hover:border-redex hover:shadow-glow-soft',
          )}
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
});
