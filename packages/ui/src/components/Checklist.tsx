import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';

export interface ChecklistItem {
  id: string;
  label: ReactNode;
  /** Pre-checked (e.g. an already-verified step). Default false. */
  done?: boolean;
}

export interface ChecklistProps extends Omit<HTMLAttributes<HTMLUListElement>, 'children'> {
  items: ChecklistItem[];
  /** Accessible name for the list (e.g. "Pre-power checklist"). */
  ariaLabel?: string;
}

/**
 * Checklist — an MDX-embeddable, READ-ONLY verification list (M2 component
 * contract): the "things to confirm" steps in a lesson. Static by design (it is
 * not a graded input — knowledge checks are the gate). Colorblind-safe: each row's
 * state is a glyph (☑ / ☐) + text, never color alone. Rendered as a real <ul> so
 * screen readers announce the count + each item.
 */
export const Checklist = forwardRef<HTMLUListElement, ChecklistProps>(function Checklist(
  { items, ariaLabel, className, ...rest },
  ref,
) {
  return (
    <ul
      ref={ref}
      aria-label={ariaLabel}
      className={cx(
        'flex flex-col gap-2 rounded-card border border-line bg-surface-2 p-4',
        className,
      )}
      {...rest}
    >
      {items.map((it) => (
        <li key={it.id} className="flex items-start gap-2 text-body text-ink">
          <span aria-hidden="true" className="shrink-0 leading-none text-body-lg">
            {it.done ? '☑' : '☐'}
          </span>
          <span className="sr-only">{it.done ? 'Done: ' : 'To do: '}</span>
          <span>{it.label}</span>
        </li>
      ))}
    </ul>
  );
});
