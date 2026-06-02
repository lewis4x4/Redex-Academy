import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';

export interface TechValueProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

/**
 * TechValue (the v2 `.tech` inline) — the warm-gold mono treatment for EVERY technical
 * value in the reading copy (24V, 0V, NC, "one in a million"). Mono / weight-600 /
 * `text-tech` (gold) / .92em / slightly negative tracking, matching the locked bar.
 *
 * Colorblind-safe: gold is a TYPOGRAPHIC distinction (a mono family + weight shift), not
 * a state signal — it never encodes pass/fail, so it needs no shape pairing. Rendered as
 * the semantic <code> element (the MDX inline-code maps to this), so a screen reader still
 * announces it as code. Token classes only — no raw hex.
 */
export const TechValue = forwardRef<HTMLElement, TechValueProps>(function TechValue(
  { className, children, ...rest },
  ref,
) {
  return (
    <code
      ref={ref}
      data-tech-value=""
      className={cx(
        'font-mono font-nav text-tech tracking-tighttitle [font-size:0.92em]',
        className,
      )}
      {...rest}
    >
      {children}
    </code>
  );
});
