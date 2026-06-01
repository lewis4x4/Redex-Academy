import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'cta';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading icon (e.g. a @redex/ui <Icon/>). Rendered aria-hidden. */
  leftIcon?: ReactNode;
}

// Token-class recipes (D1, matched to the prototype). No raw hex — every class is
// backed by a CSS variable via the Tailwind preset. `cta` = the full-width launch
// button; primary = the 135° red→deep gradient + glow that lifts on hover.
const BASE =
  'inline-flex items-center justify-center gap-2 font-label rounded-[10px] transition-all duration-hover ' +
  'disabled:cursor-not-allowed disabled:translate-y-0';

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-grad-cta text-white shadow-glow hover:-translate-y-px ' +
    'disabled:bg-none disabled:bg-disabled-bg disabled:text-disabled-fg disabled:shadow-none',
  secondary:
    'bg-surface-hover text-white border border-line hover:border-redex hover:shadow-glow-soft ' +
    'disabled:text-disabled-fg disabled:border-line disabled:shadow-none',
  ghost:
    'bg-transparent text-ink-muted border border-transparent hover:text-white hover:bg-surface-hover ' +
    'disabled:text-disabled-fg disabled:bg-transparent',
  cta:
    'w-full bg-grad-cta text-white shadow-glow font-display font-bold tracking-name hover:-translate-y-0.5 ' +
    'disabled:bg-none disabled:bg-disabled-bg disabled:text-disabled-fg disabled:shadow-none',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-caption',
  md: 'px-[18px] py-[11px] text-body',
  lg: 'px-[18px] py-4 text-subtitle',
};

/**
 * The primary action primitive (D1). Colorblind-safe by construction — never relies
 * on color alone for meaning; pair with text/icon. Keyboard-focusable native button
 * with the global brand focus ring (styles/index.css). `cta` is the full-width
 * launch button; `lg` matches the launch-button scale.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', leftIcon, className, type, children, ...rest },
  ref,
) {
  const computedSize = variant === 'cta' ? SIZE.lg : SIZE[size];
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cx(BASE, VARIANT[variant], computedSize, className)}
      {...rest}
    >
      {leftIcon ? (
        <span aria-hidden="true" className="inline-flex">
          {leftIcon}
        </span>
      ) : null}
      {children}
    </button>
  );
});
