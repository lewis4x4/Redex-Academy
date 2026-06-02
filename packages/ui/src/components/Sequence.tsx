import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';

export interface SequenceItem {
  /** The displayed index (defaults to the 1-based position when omitted). */
  n?: ReactNode;
  /** The step's bold display label (the `.lab`). */
  label: ReactNode;
  /** The step's supporting line (the `.desc`) — may contain inline <TechValue/> etc. */
  desc?: ReactNode;
}

export interface SequenceProps extends Omit<HTMLAttributes<HTMLOListElement>, 'children'> {
  /** The ordered steps. THE editorial numbered-list pattern (the v2 `.seq`). */
  items: SequenceItem[];
  /** Accessible name for the list (e.g. "Follow the power"). */
  ariaLabel?: string;
}

/**
 * Sequence — the v2 `.seq` editorial numbered list, THE pattern for an ordered set of
 * steps (e.g. "Follow the power" 1–4). A semantic <ol> with a hairline top + per-row
 * `border-line` divider; each row is a rounded-square index badge (`bg-surface-2` +
 * `border-line-strong`, mono `text-redex-bright` number) beside a `font-display`-600
 * label (`text-ink-strong`) over an `ink-muted` description.
 *
 * The number is a real ordered-list ordinal (the <ol> carries position for AT); the badge
 * glyph is aria-hidden so the count isn't double-announced. Token classes only — no raw hex.
 */
export const Sequence = forwardRef<HTMLOListElement, SequenceProps>(function Sequence(
  { items, ariaLabel, className, ...rest },
  ref,
) {
  return (
    <ol
      ref={ref}
      aria-label={ariaLabel}
      className={cx('m-0 list-none border-t border-line p-0', className)}
      {...rest}
    >
      {items.map((item, i) => (
        <li
          // steps are positional with no stable id → the index is the key
          key={i}
          className="flex gap-4 border-b border-line py-4"
        >
          <span
            aria-hidden="true"
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] border border-line-strong bg-surface-2 font-mono font-nav text-body text-redex-bright"
          >
            {item.n ?? i + 1}
          </span>
          <div className="min-w-0">
            <div className="mb-0.5 font-display font-nav text-subtitle text-ink-strong">
              {item.label}
            </div>
            {item.desc != null ? (
              <div className="text-body-lg leading-lede text-ink-muted">{item.desc}</div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
});
