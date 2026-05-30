import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';

export type TagVariant = 'default' | 'tier' | 'gate' | 'boss' | 'keystone';

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  /**
   * Semantic flavor of the tag. `gate` and `keystone` are colorblind-safe by
   * construction — they carry a leading glyph + their label text, never color alone.
   */
  variant?: TagVariant;
}

// Token-class recipes (D1 §5.6, matched to the prototype). No raw hex — every class is
// backed by a CSS variable via the Tailwind preset. The base tag is the neutral pill;
// `tier`/`gate`/`boss` quote the prototype tint formula (border = hue @ ~.4–.5, bg = hue
// @ ~.12) via the TINT/EDGE tokens. `keystone` is NEW — authored distinct from `boss`:
// the gold mastery hue + ◆ glyph + soft halo, so the two never read as the same tag.
const BASE =
  'inline-flex items-center gap-1.5 uppercase text-eyebrow font-label tracking-label ' +
  'rounded-[7px] px-[10px] py-[5px] align-middle';

const VARIANT: Record<TagVariant, string> = {
  default: 'bg-surface-2 text-ink-soft border border-line',
  tier: 'bg-red-tint text-redex-bright border border-red-edge',
  gate: 'bg-amber-tint text-amber border border-amber-edge',
  boss: 'bg-surface-4 text-redex-bright border border-redex',
  keystone: 'bg-surface-4 text-gold border border-gold shadow-glow-soft',
};

// Leading glyphs make the colorblind-sensitive variants legible without relying on hue.
// `gate` = ⚠ warning; `keystone` = ◆ (its distinguishing mark vs. the red `boss`).
const GLYPH: Partial<Record<TagVariant, string>> = {
  gate: '⚠', // ⚠
  keystone: '◆', // ◆
};

/**
 * Tag — a small uppercase metadata pill (D1 §5.6). Decorative by default; pass an
 * explicit `role`/`aria-label` via ...rest if it conveys standalone meaning. Status is
 * never color-only: the `gate` and `keystone` variants pair their hue with a glyph and
 * their label text (CODING_STANDARDS §9 colorblind-safe).
 */
export const Tag = forwardRef<HTMLSpanElement, TagProps>(function Tag(
  { variant = 'default', className, children, ...rest },
  ref,
) {
  const glyph = GLYPH[variant];
  return (
    <span ref={ref} className={cx(BASE, VARIANT[variant], className)} {...rest}>
      {glyph ? (
        <span aria-hidden="true" className="leading-none">
          {glyph}
        </span>
      ) : null}
      {children as ReactNode}
    </span>
  );
});
