import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { cx } from '../cx';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Visible label text, rendered in a card-style wrapper alongside the native input. */
  label?: ReactNode;
}

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Visible label text, rendered in a card-style wrapper alongside the native input. */
  label?: ReactNode;
}

export interface SwitchProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'value'
> {
  /** Controlled on/off state. Mirrored to `aria-checked` (colorblind-safe — the knob
   *  position carries state by shape, never the red fill alone). */
  checked?: boolean;
  /** Fired with the next checked value when toggled by click/keyboard. */
  onCheckedChange?: (checked: boolean) => void;
  /** Accessible name for the switch when no visible label is associated. */
  label?: string;
}

// Token-class recipes (D1 §7.3–7.5). No raw hex — every class is backed by a CSS
// variable via the Tailwind preset. The prototype lacks styled toggles; these are
// authored on-brand from the inline native checkbox (§7.5: surface-4 card,
// line border, 9px radius, accent-color = brand red) and the §7.4 switch recipe.

// Card-style label wrapper shared by Checkbox + Radio (the prototype's inline
// surface-4 / line / 9px-radius label cell). Hover lifts the border to red.
const CONTROL_LABEL =
  'inline-flex items-center gap-2.5 px-3 py-2.5 rounded-control bg-surface-4 ' +
  'border border-line text-body text-white cursor-pointer transition-all duration-hover ' +
  'hover:border-redex has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 ' +
  'has-[:disabled]:hover:border-line';

// Native input: 16×16, brand accent so the checked fill is Redex red. The native
// control keeps it keyboard-operable + announced (role from the input type).
const CONTROL_INPUT = 'h-4 w-4 shrink-0 accent-redex cursor-pointer disabled:cursor-not-allowed';

/**
 * Checkbox (D1 §7.5) — a native `<input type="checkbox">` wrapped in the on-brand card
 * label. `accent-redex` paints the checked fill brand red; the native checkmark glyph
 * plus the associated text carry meaning beyond color (colorblind-safe). Keyboard-operable
 * by default with the global brand focus ring (styles/index.css). forwardRef targets the
 * input; extra `className` merges onto the wrapping label.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <label htmlFor={inputId} className={cx(CONTROL_LABEL, className)}>
      <input ref={ref} id={inputId} type="checkbox" className={CONTROL_INPUT} {...rest} />
      {label != null ? <span>{label}</span> : null}
    </label>
  );
});

/**
 * Radio (D1 §7.3, authored on-brand to mirror Checkbox) — a native `<input type="radio">`
 * in the same card label. Group several by sharing a `name`. `accent-redex` paints the
 * checked dot brand red; the native dot + label text convey state beyond color alone.
 * Keyboard-operable (arrow keys within a group) with the global focus ring.
 */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <label htmlFor={inputId} className={cx(CONTROL_LABEL, className)}>
      <input ref={ref} id={inputId} type="radio" className={CONTROL_INPUT} {...rest} />
      {label != null ? <span>{label}</span> : null}
    </label>
  );
});

// Switch track: surface-2 when off → solid brand red when on; knob slides via translate.
const SWITCH_TRACK =
  'relative inline-flex h-6 w-11 shrink-0 items-center rounded-pill border border-line ' +
  'transition-all duration-hover cursor-pointer ' +
  'disabled:cursor-not-allowed disabled:opacity-60';
const SWITCH_TRACK_ON = 'bg-redex border-redex';
const SWITCH_TRACK_OFF = 'bg-surface-2';

// Knob: white puck that translates from left (off) to right (on).
const SWITCH_KNOB =
  'pointer-events-none inline-block h-[18px] w-[18px] rounded-full bg-white shadow-card ' +
  'transition-transform duration-hover';
const SWITCH_KNOB_ON = 'translate-x-[22px]';
const SWITCH_KNOB_OFF = 'translate-x-[2px]';

/**
 * Switch (D1 §7.4) — an accessible toggle: a native button with `role="switch"` and
 * `aria-checked`, so screen readers announce on/off without relying on the red fill.
 * The track is `surface-2` when off and brand red when on; the white knob slides with a
 * `duration-hover` transition (auto-respecting prefers-reduced-motion). Colorblind-safe:
 * state is carried by the knob position (shape) + `aria-checked`, never color alone.
 * Native button = keyboard-operable (Space/Enter) with the global brand focus ring.
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked = false, onCheckedChange, label, className, disabled, onClick, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cx(SWITCH_TRACK, checked ? SWITCH_TRACK_ON : SWITCH_TRACK_OFF, className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onCheckedChange?.(!checked);
      }}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cx(SWITCH_KNOB, checked ? SWITCH_KNOB_ON : SWITCH_KNOB_OFF)}
      />
    </button>
  );
});
