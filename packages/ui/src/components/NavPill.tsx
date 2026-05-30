import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';

export interface NavPillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Marks this pill as the current page: red-tint fill, red edge, soft glow,
   *  white text, and `aria-current="page"` for assistive tech. */
  active?: boolean;
  /** Optional leading icon (e.g. a @redex/ui <Icon/>). Rendered aria-hidden. */
  leftIcon?: ReactNode;
}

// Token-class recipe (D1 §5.4, `.nav-btn` + `.dot`). No raw hex — every class is
// backed by a CSS variable via the Tailwind preset. The ghost nav button: transparent
// at rest, fills `surface-hover` on hover, and lights up with the red tint + soft glow
// when active. Colorblind-safe: active state carries text + `aria-current` + the dot,
// never color alone.
const BASE =
  'inline-flex items-center gap-2 px-4 py-[9px] rounded-control text-body font-nav tracking-nav ' +
  'border border-transparent bg-transparent text-ink-muted transition-all duration-nav ease-out ' +
  'hover:text-white hover:bg-surface-hover ' +
  'disabled:cursor-not-allowed disabled:text-disabled-fg disabled:bg-transparent disabled:shadow-none';

const ACTIVE = 'bg-red-tint border-red-edge shadow-glow-soft text-white';

/**
 * NavPill (D1) — the primary nav primitive (`.nav-btn`). A native button so it is
 * keyboard-operable by default and inherits the global brand focus ring. The 6px
 * currentColor dot tracks the text color (muted → white → white). Set `active` for the
 * current page; that also emits `aria-current="page"`.
 */
export const NavPill = forwardRef<HTMLButtonElement, NavPillProps>(function NavPill(
  { active = false, leftIcon, className, type, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-current={active ? 'page' : undefined}
      className={cx(BASE, active && ACTIVE, className)}
      {...rest}
    >
      {leftIcon ? (
        <span aria-hidden="true" className="inline-flex">
          {leftIcon}
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70"
      />
      {children}
    </button>
  );
});
