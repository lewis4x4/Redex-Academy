import { forwardRef, type SVGAttributes } from 'react';
import { cx } from '../cx';

/**
 * The registry of available icon names (D1 §5.16). Exported as a readonly tuple so
 * consumers can derive a union, iterate the set, or validate a name at runtime.
 */
export const ICON_NAMES = ['play', 'check', 'store', 'warn', 'bolt'] as const;

export type IconName = (typeof ICON_NAMES)[number];

/**
 * One registry entry. `d` is the path geometry; `mode` picks fill vs stroke so a
 * single <Icon/> renders both the solid marks (play/bolt) and the lined marks
 * (check/store/warn) from one element. `strokeWidth` is per-icon (the prototype
 * uses 3 for check, 2 for store, 2.2 for warn).
 */
interface IconDef {
  /** SVG path data (a 24×24 viewBox). */
  d: string;
  /** Solid fill vs stroked outline — matches the prototype `svgIcon` set. */
  mode: 'fill' | 'stroke';
  /** Stroke width for `mode: 'stroke'` icons (ignored for fills). */
  strokeWidth?: number;
}

// Verbatim path geometry from the prototype `svgIcon` set (D1 §5.16). All draw on a
// 24×24 viewBox and inherit `currentColor`, so callers tint via text-* token classes
// (e.g. `text-redex-bright`, `text-green`) — never a raw hex on the icon itself.
const REGISTRY: Record<IconName, IconDef> = {
  // ▶ play — solid triangle.
  play: { d: 'M8 5v14l11-7z', mode: 'fill' },
  // ✓ check — round-joined stroke, weight 3.
  check: { d: 'M5 13l4 4L19 7', mode: 'stroke', strokeWidth: 3 },
  // 🏪 store — awning + box, weight 2.
  store: { d: 'M3 9l1.5-5h15L21 9M4 9v11h16V9M4 9h16', mode: 'stroke', strokeWidth: 2 },
  // ⚠ warn — triangle + exclamation, weight 2.2 (the gate/alert mark).
  warn: { d: 'M12 3 2 21h20L12 3zM12 9v6M12 18h.01', mode: 'stroke', strokeWidth: 2.2 },
  // ⚡ bolt — solid lightning, the proof-point mark.
  bolt: { d: 'M13 2 4 14h6l-1 8 9-12h-6l1-8z', mode: 'fill' },
};

export interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, 'name'> {
  /** Which registered glyph to render (see {@link ICON_NAMES}). */
  name: IconName;
  /**
   * Square edge length in px (sets width + height). Defaults to 24 to match the
   * 24×24 source viewBox.
   */
  size?: number;
  /**
   * Accessible name. When provided, the icon is exposed to AT as `role="img"` with
   * this label; when omitted, the icon is purely decorative (`aria-hidden`).
   */
  title?: string;
}

/**
 * Icon — the inline-SVG icon set (D1 §5.16). A single element renders any registered
 * 24×24 glyph in `currentColor`, so callers tint it with text-* token classes (e.g.
 * `<Icon name="bolt" className="text-redex-bright" />`) rather than any raw hex.
 *
 * a11y: pass `title` when the icon carries standalone meaning — it then renders
 * `role="img"` with an `<title>` and `aria-label`. With no `title` it is decorative
 * and `aria-hidden`/`focusable="false"` so screen readers skip it. Status is never
 * color-only: meaning comes from the glyph shape (and any accompanying text), so the
 * set stays colorblind-safe.
 */
export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  { name, size = 24, title, className, ...rest },
  ref,
) {
  const def = REGISTRY[name];
  const isFill = def.mode === 'fill';
  const labelled = title !== undefined && title !== '';

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cx('inline-block shrink-0', className)}
      fill={isFill ? 'currentColor' : 'none'}
      stroke={isFill ? undefined : 'currentColor'}
      strokeWidth={isFill ? undefined : def.strokeWidth}
      strokeLinecap={isFill ? undefined : 'round'}
      strokeLinejoin={isFill ? undefined : 'round'}
      role={labelled ? 'img' : undefined}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
      {...rest}
    >
      {labelled ? <title>{title}</title> : null}
      <path d={def.d} />
    </svg>
  );
});
