import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cx } from '../cx';

// Token-class recipes (D1 §7.1–7.2 — the prototype LACKS form fields, so these are
// authored on-brand from the §7 derivation: bg-panel-2 + 1px line border + control
// radius; focus → red border + soft glow, matching `.btn:hover` (border-redex
// shadow-glow-soft). Disabled is dimmed via the shared disabled tokens. No raw hex —
// every class is backed by a CSS variable via the Tailwind preset.
const FIELD_BASE =
  'block w-full bg-panel-2 text-white border border-line rounded-control ' +
  'px-3 py-[11px] text-body font-sans transition-all duration-hover ' +
  'placeholder:text-ink-dim ' +
  'focus:outline-none focus:border-redex focus:shadow-glow-soft ' +
  'disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:text-disabled-fg ' +
  'disabled:border-line disabled:shadow-none';

// The label sits above the control: a tracked, muted form label that always pairs
// with the field so the control is never an unlabelled input (WCAG 2.1 AA).
const LABEL = 'block text-label font-label tracking-label text-ink-muted mb-1.5';

// A field is "labelled" if it has a rendered <label> (via `label`) OR an explicit
// aria-label / aria-labelledby. We compute the id wiring once and share it across all
// three controls so they stay consistent.
interface LabelWiring {
  /** id wired to both the control and the rendered <label htmlFor>. */
  fieldId: string;
  /** Whether to render a visible <label> element above the control. */
  showLabel: boolean;
}

function useLabelWiring(id: string | undefined, label: ReactNode | undefined): LabelWiring {
  const generatedId = useId();
  return {
    fieldId: id ?? generatedId,
    showLabel: label != null,
  };
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * Visible field label. Rendered as a `<label htmlFor>` above the control and
   * wired to it. Omit only when you supply an `aria-label`/`aria-labelledby` —
   * a field must always be labelled (WCAG 2.1 AA).
   */
  label?: ReactNode;
}

/**
 * Text Input (D1 §7.1). Native `<input>` so it is keyboard-operable and inherits the
 * global brand focus treatment; focus shows the red border + soft glow (matching
 * `.btn:hover`). Always pair with a label: pass `label` to render a visible
 * `<label htmlFor>`, or supply `aria-label`/`aria-labelledby` via ...rest. Forwards
 * its ref, spreads ...rest, and merges an external className via cx.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, id, className, type, ...rest },
  ref,
) {
  const { fieldId, showLabel } = useLabelWiring(id, label);
  return (
    <div className="w-full">
      {showLabel ? (
        <label htmlFor={fieldId} className={LABEL}>
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={fieldId}
        type={type ?? 'text'}
        className={cx(FIELD_BASE, className)}
        {...rest}
      />
    </div>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Visible field label (see {@link InputProps.label}). */
  label?: ReactNode;
}

/**
 * Select (D1 §7.2). Native `<select>` for full keyboard + screen-reader support and
 * the platform option list; styled to match the Input surface with the same red
 * focus treatment. Always pair with a label (`label` or `aria-label`). The chevron
 * affordance comes from the native control; `appearance-none` is intentionally NOT
 * set so the platform indicator and a11y semantics are preserved.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, id, className, children, ...rest },
  ref,
) {
  const { fieldId, showLabel } = useLabelWiring(id, label);
  return (
    <div className="w-full">
      {showLabel ? (
        <label htmlFor={fieldId} className={LABEL}>
          {label}
        </label>
      ) : null}
      <select ref={ref} id={fieldId} className={cx(FIELD_BASE, className)} {...rest}>
        {children}
      </select>
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Visible field label (see {@link InputProps.label}). */
  label?: ReactNode;
}

/**
 * Textarea (D1 §7.2). Native `<textarea>`, same on-brand surface + red focus
 * treatment as {@link Input}. Always pair with a label (`label` or `aria-label`).
 * Defaults to a comfortable min-height and vertical resize only (so it cannot break
 * the layout horizontally). Forwards its ref, spreads ...rest, merges className.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, id, className, rows, ...rest },
  ref,
) {
  const { fieldId, showLabel } = useLabelWiring(id, label);
  return (
    <div className="w-full">
      {showLabel ? (
        <label htmlFor={fieldId} className={LABEL}>
          {label}
        </label>
      ) : null}
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows ?? 4}
        className={cx(FIELD_BASE, 'min-h-[88px] resize-y leading-[1.5]', className)}
        {...rest}
      />
    </div>
  );
});
