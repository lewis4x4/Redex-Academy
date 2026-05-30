import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from '../cx';

export type ChipVariant = 'default' | 'persona';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Toggled/selected state (`.chip.on` in the prototype). Mirrored to aria-pressed. */
  selected?: boolean;
  /** `'persona'` swaps the selected fill to the GOLD lens accent (`.chip.persona.on`). */
  variant?: ChipVariant;
}

export interface TabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Active tab (`.sim-tab.active`): panel fill + the 3px red underline bar. */
  active?: boolean;
}

// Token-class recipes (D1 §5.5, verbatim from the prototype). No raw hex — every
// class is backed by a CSS variable via the Tailwind preset. The chip radius is the
// prototype's 20px pill (`--rx-r-pill-sm`), distinct from the 30px `rounded-pill`.
const CHIP_BASE =
  'inline-flex items-center gap-1.5 px-[11px] py-[5px] rounded-[20px] text-label font-nav ' +
  'border transition-all duration-hover ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

// Resting + hover. `on` (selected) overrides border/bg/text/glow.
const CHIP_RESTING = 'bg-surface-2 border-line text-ink-soft hover:border-redex hover:text-white';

const CHIP_ON: Record<ChipVariant, string> = {
  // `.chip.on`: translucent red tint over dark + red edge + white text + soft glow
  // halo — the same selected treatment the active NavPill uses (passes WCAG AA on
  // the dark canvas, where white-on-solid-#ED1B24 at 11px did not).
  default: 'bg-red-tint border-red-edge text-white shadow-glow-soft',
  // `.chip.persona.on`: GOLD lens accent — surface-hover fill, gold border + text.
  persona: 'bg-surface-hover border-gold text-gold',
};

/**
 * Filter / selection chip (D1 §5.5). A native toggle button: `selected` is mirrored to
 * `aria-pressed` so the on/off state is conveyed beyond color alone (colorblind-safe —
 * pair the label text + pressed state, never rely on the red/gold fill by itself).
 * Keyboard-focusable with the global brand focus ring (styles/index.css).
 */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected = false, variant = 'default', className, type, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-pressed={selected}
      className={cx(CHIP_BASE, selected ? CHIP_ON[variant] : CHIP_RESTING, className)}
      {...rest}
    >
      {children}
    </button>
  );
});

// Tab (`.sim-tab`): top-rounded surface tab; the active tab fills with the panel
// surface and grows a 3px red underline bar (rendered as a child element rather than
// a ::after pseudo so it stays token-driven and present in the accessibility tree-free
// decorative layer).
const TAB_BASE =
  'relative inline-flex items-center gap-2 px-4 py-2.5 rounded-t-[10px] text-body font-label ' +
  'border border-b-0 transition-all duration-nav ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

const TAB_RESTING = 'bg-surface-1 border-line text-ink-muted hover:text-white';
const TAB_ACTIVE = 'bg-panel border-line text-white';

/**
 * Sim/section tab (D1 §5.5). Native button with `role="tab"` and `aria-selected`, so the
 * active state is announced (not color-only). Place inside a `role="tablist"` container.
 * The 3px red underline is a decorative bar; the selected state is carried by aria-selected
 * + the panel fill, keeping it colorblind-safe.
 */
export const Tab = forwardRef<HTMLButtonElement, TabProps>(function Tab(
  { active = false, className, type, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      role="tab"
      aria-selected={active}
      className={cx(TAB_BASE, active ? TAB_ACTIVE : TAB_RESTING, className)}
      {...rest}
    >
      {children}
      {active ? (
        <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-[3px] bg-redex" />
      ) : null}
    </button>
  );
});
