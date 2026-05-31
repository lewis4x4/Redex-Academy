import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';

export type CalloutTone = 'info' | 'safety' | 'warning';

// Colorblind-safe by construction (D1 §9 / invariant 7): every tone carries a SHAPE
// (leading glyph) + a TEXT label + a token color — never color alone. No raw hex
// (the no-raw-hex lint rule); tones map to design tokens only.
interface ToneSpec {
  glyph: string;
  /** Visible tone word (so meaning is never color-only). i18n key resolved by the caller's `label`. */
  defaultLabel: string;
  frame: string;
  accent: string;
}
const TONES: Record<CalloutTone, ToneSpec> = {
  info: { glyph: 'ⓘ', defaultLabel: 'Note', frame: 'border-line', accent: 'text-ink' },
  warning: { glyph: '▲', defaultLabel: 'Caution', frame: 'border-amber', accent: 'text-amber' },
  // redex-bright (#ff3b43), not redex (#ed1b24): the small tone WORD must clear AA
  // (4.5:1) on the dark surface — #ed1b24 is only 3.94:1. The red border carries the tone too.
  safety: {
    glyph: '⛔',
    defaultLabel: 'Safety',
    frame: 'border-redex',
    accent: 'text-redex-bright',
  },
};

export interface CalloutProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** info (neutral), warning (caution), or safety (life-safety / locked-glossary call-out). */
  tone?: CalloutTone;
  /** The tone word shown to the user (already localized). Falls back to a built-in English word. */
  label?: ReactNode;
  /** Optional headline above the body. */
  title?: ReactNode;
  children: ReactNode;
}

/**
 * Callout — an MDX-embeddable call-out box (M2 component contract). The `safety`
 * tone is the locked-safety-glossary call-out (fail-safe/fail-locked, REX, egress).
 * Rendered as an <aside role="note"> with the tone carried by glyph + word + color
 * (colorblind-safe). The glyph is aria-hidden; the tone word + body carry meaning.
 */
export const Callout = forwardRef<HTMLElement, CalloutProps>(function Callout(
  { tone = 'info', label, title, className, children, ...rest },
  ref,
) {
  const t = TONES[tone];
  return (
    <aside
      ref={ref}
      role="note"
      data-tone={tone}
      className={cx(
        'flex gap-3 border-l-4 rounded-card bg-surface-2 px-4 py-3 text-body text-ink',
        t.frame,
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className={cx('shrink-0 text-title leading-none', t.accent)}>
        {t.glyph}
      </span>
      <div className="flex flex-col gap-1">
        <span className={cx('font-label text-label uppercase tracking-wide', t.accent)}>
          {label ?? t.defaultLabel}
        </span>
        {title ? <span className="font-label text-body-lg text-white">{title}</span> : null}
        <div>{children}</div>
      </div>
    </aside>
  );
});
