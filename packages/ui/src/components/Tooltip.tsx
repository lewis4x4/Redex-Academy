import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content'> {
  /** Controlled visibility. When false the bubble is hidden (faded + nudged) and aria-hidden. */
  open?: boolean;
  /** The anchor the tooltip is positioned against. Rendered inline; the bubble overlays it. */
  children: ReactNode;
  /** The tooltip body (compose with <TooltipCode/Title/Meta/Hint>). */
  content: ReactNode;
  /** Which side of the anchor the bubble sits on. */
  placement?: TooltipPlacement;
}

// Token-class recipe (D1, §5.7 #tooltip). No raw hex — gradient + border + shadow are all
// token-backed. The combined `shadow-[var(--shadow-card),var(--glow-soft)]` reproduces the
// prototype's `box-shadow:0 10px 40px rgba(0,0,0,.6),var(--glow-soft)` via CSS vars (no rgba
// in the .tsx). Hidden state = fade + 6px translate; show = fade in + settle to 0.
const BUBBLE_BASE =
  'pointer-events-none absolute z-[80] w-max max-w-[280px] rounded-card px-[14px] py-3 ' +
  'bg-grad-panel border border-redex shadow-[var(--shadow-card),var(--glow-soft)] ' +
  'transition-all duration-hover ease-out';

const BUBBLE_HIDDEN = 'opacity-0';
const BUBBLE_SHOWN = 'opacity-100';

// Placement = anchor-relative position + the resting/entry translate. Each side fades in from
// a 6px offset toward the anchor (matching the prototype's translateY(6px) → 0 on the default).
const PLACEMENT: Record<TooltipPlacement, { open: string; closed: string }> = {
  top: {
    open: 'bottom-full left-1/2 -translate-x-1/2 mb-2 translate-y-0',
    closed: 'bottom-full left-1/2 -translate-x-1/2 mb-2 translate-y-[6px]',
  },
  bottom: {
    open: 'top-full left-1/2 -translate-x-1/2 mt-2 translate-y-0',
    closed: 'top-full left-1/2 -translate-x-1/2 mt-2 -translate-y-[6px]',
  },
  left: {
    open: 'right-full top-1/2 -translate-y-1/2 mr-2 translate-x-0',
    closed: 'right-full top-1/2 -translate-y-1/2 mr-2 translate-x-[6px]',
  },
  right: {
    open: 'left-full top-1/2 -translate-y-1/2 ml-2 translate-x-0',
    closed: 'left-full top-1/2 -translate-y-1/2 ml-2 -translate-x-[6px]',
  },
};

/**
 * A controlled, positioned tooltip (D1, §5.7). The anchor `children` render inline; the bubble
 * is absolutely positioned over them — no portal. Show/hide is driven by the `open` prop with a
 * fade + translate transition. The bubble is `role="tooltip"` and `aria-hidden` while closed, and
 * is always `pointer-events-none` so it never intercepts pointer input. Colorblind-safe by
 * construction: it carries text, never color alone. Wire the anchor's `aria-describedby` to the
 * tooltip `id` for assistive tech.
 */
export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(function Tooltip(
  { open = false, children, content, placement = 'top', className, ...rest },
  ref,
) {
  const place = PLACEMENT[placement];
  return (
    <span className="relative inline-flex">
      {children}
      <div
        ref={ref}
        role="tooltip"
        aria-hidden={!open}
        className={cx(
          BUBBLE_BASE,
          open ? BUBBLE_SHOWN : BUBBLE_HIDDEN,
          open ? place.open : place.closed,
          className,
        )}
        {...rest}
      >
        {content}
      </div>
    </span>
  );
});

export type TooltipPartProps = HTMLAttributes<HTMLDivElement>;

/** Eyebrow code line (e.g. a course/competency code) — 10px, 2px-tracked, brand red-bright. */
export const TooltipCode = forwardRef<HTMLDivElement, TooltipPartProps>(function TooltipCode(
  { className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx(
        'text-eyebrow font-label uppercase tracking-label text-redex-bright',
        className,
      )}
      {...rest}
    />
  );
});

/** Primary tooltip heading — 14px, weight 700, line-height 1.25. */
export const TooltipTitle = forwardRef<HTMLDivElement, TooltipPartProps>(function TooltipTitle(
  { className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx('text-body-lg font-label leading-[1.25] text-white', className)}
      {...rest}
    />
  );
});

/** Secondary meta line — 11px, muted. */
export const TooltipMeta = forwardRef<HTMLDivElement, TooltipPartProps>(function TooltipMeta(
  { className, ...rest },
  ref,
) {
  return <div ref={ref} className={cx('text-label text-ink-muted', className)} {...rest} />;
});

/** Tertiary hint — 10px, dim, italic. */
export const TooltipHint = forwardRef<HTMLDivElement, TooltipPartProps>(function TooltipHint(
  { className, ...rest },
  ref,
) {
  return <div ref={ref} className={cx('text-eyebrow italic text-ink-dim', className)} {...rest} />;
});
