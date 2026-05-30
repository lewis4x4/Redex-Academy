import type { ReactElement } from 'react';
import { cx } from '../cx';

export interface BrandMarkProps {
  /** Show the "Mastery, not seat-time" eyebrow under the wordmark (default true). */
  showTagline?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * The Redex Academy brand lockup (D1): the glowing red "R" mark + the wordmark
 * (REDEX in white, ACADEMY in the brighter brand red that clears WCAG AA on the
 * dark panel) + the tagline eyebrow. Shared by the app
 * header and the login screen so the identity is defined once. The mark is
 * decorative (aria-hidden); the wordmark text is the accessible name.
 */
export function BrandMark({
  showTagline = true,
  size = 'md',
  className,
}: BrandMarkProps): ReactElement {
  const mark = size === 'sm' ? 'h-7 w-7 text-subtitle' : 'h-[34px] w-[34px] text-title';
  return (
    <div className={cx('flex select-none items-center gap-3', className)}>
      <span
        aria-hidden="true"
        className={cx(
          'flex items-center justify-center rounded-mark bg-redex font-display tracking-tightmark text-white shadow-glow',
          mark,
        )}
      >
        R
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-subtitle font-bold tracking-name">
          REDEX <span className="text-redex-bright">ACADEMY</span>
        </span>
        {showTagline ? (
          <span className="-mt-0.5 text-eyebrow uppercase tracking-eyebrow text-ink-muted">
            Mastery, not seat-time
          </span>
        ) : null}
      </div>
    </div>
  );
}
