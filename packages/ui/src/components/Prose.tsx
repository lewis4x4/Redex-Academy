import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';

export interface ProseProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Prose — the v2 reading-measure cap. Caps a reading column at `max-w-[640px]` (~68ch),
 * the band that keeps lines in the readable 45–75ch range, at the relaxed 1.72 reading
 * line-height and off-white body ink. Wrap a step's MDX body in this so the copy never
 * runs the full panel width. Pure layout — no content/data logic. Token classes only;
 * no raw hex.
 */
export const Prose = forwardRef<HTMLDivElement, ProseProps>(function Prose(
  { className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      data-prose=""
      className={cx('w-full max-w-[640px] text-prose text-ink', className)}
      {...rest}
    >
      {children}
    </div>
  );
});
