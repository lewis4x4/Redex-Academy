import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';

export type CalloutTone = 'info' | 'safety' | 'warning';

// Colorblind-safe by construction (D1 §9 / invariant 7): every STATE-bearing tone carries
// a SHAPE (leading glyph) + a TEXT label + a token color — never color alone. `info` is the
// v2 `.note` — a neutral editorial aside (not a state), so it leads with its mono "NOTE"
// word + a quiet ink-3 left rule rather than a loud glyph. `safety`/`warning` are states and
// keep glyph + word + color. No raw hex (the no-raw-hex lint rule); tones map to tokens only.
interface ToneSpec {
  /** Optional leading glyph. Omitted for the neutral `info`/note tone. */
  glyph?: string;
  /** Visible tone word (so meaning is never color-only). i18n key resolved by the caller's `label`. */
  defaultLabel: string;
  /** The whole-box frame (background + border + left accent + radius/pad). */
  frame: string;
  /** The tone WORD + glyph color. */
  accent: string;
}
const TONES: Record<CalloutTone, ToneSpec> = {
  // v2 `.note`: panel surface, hairline border, a 3px ink-3 left rule, mono "NOTE" label.
  // The LEFT RULE is the quiet ink-3 of the bar (a decorative border, no contrast floor);
  // the label TEXT uses ink-muted so the small mono word clears WCAG AA on the panel.
  info: {
    defaultLabel: 'Note',
    frame:
      'bg-panel border border-line border-l-[3px] border-l-ink-dim rounded-[10px] px-[17px] py-[15px]',
    accent: 'text-ink-muted',
  },
  // Caution (a state): amber word + glyph + a 3px amber left rule on the v2 panel surface.
  warning: {
    glyph: '▲',
    defaultLabel: 'Caution',
    frame:
      'bg-panel border border-line border-l-[3px] border-l-amber rounded-[10px] px-[17px] py-[15px]',
    accent: 'text-amber',
  },
  // Safety (the locked life-safety call-out): a red border carries the tone with the
  // word + glyph. redex-bright (#ff5b62), not redex (#ed1b24): the small tone WORD must
  // clear AA (4.5:1) on the dark surface.
  safety: {
    glyph: '⛔',
    defaultLabel: 'Safety',
    frame:
      'bg-redex-dim border border-redex border-l-[3px] border-l-redex rounded-[10px] px-[17px] py-[15px]',
    accent: 'text-redex-bright',
  },
};

export interface CalloutProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** info (neutral note), warning (caution), or safety (life-safety / locked-glossary call-out). */
  tone?: CalloutTone;
  /** The tone word shown to the user (already localized). Falls back to a built-in English word. */
  label?: ReactNode;
  /** Optional headline above the body. */
  title?: ReactNode;
  children: ReactNode;
}

/**
 * Callout — an MDX-embeddable call-out box (M2 component contract), refined to the v2
 * `.note` visual bar. The `info` tone is the neutral editorial NOTE (mono label + quiet
 * ink-3 left rule). The `safety` tone is the locked-safety-glossary call-out
 * (fail-safe/fail-locked, REX, egress) and `warning` is caution — both states, so they
 * carry glyph + word + color (colorblind-safe). Rendered as an <aside role="note"> with a
 * mono uppercase tone label + an ink-muted body; the glyph (when present) is aria-hidden.
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
      className={cx('flex gap-3 text-body-lg text-ink-muted', t.frame, className)}
      {...rest}
    >
      {t.glyph ? (
        <span aria-hidden="true" className={cx('shrink-0 text-subtitle leading-none', t.accent)}>
          {t.glyph}
        </span>
      ) : null}
      <div className="flex flex-col gap-1">
        <span
          className={cx('font-mono text-label uppercase tracking-label leading-none', t.accent)}
        >
          {label ?? t.defaultLabel}
        </span>
        {title ? (
          <span className="font-display font-nav text-body-lg text-ink-strong">{title}</span>
        ) : null}
        <div className="leading-lede">{children}</div>
      </div>
    </aside>
  );
});
