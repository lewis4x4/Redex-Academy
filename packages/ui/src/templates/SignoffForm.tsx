import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';
import { Card } from '../components/Card';
import { EmptyState } from '../components/States';

/**
 * The four §5.4 sign-off rubric dimensions (CLAUDE.md invariant 1). These keys are FIXED
 * by the safety-veto contract — a template may not add/remove/rename them. The labels are
 * the on-brand display strings for each fixed section header. M6 fills the line items +
 * scoring controls (the slots below); NO scoring/rollup/veto logic lives here.
 */
export type SignoffDimensionKey =
  | 'safety_compliance'
  | 'technical_execution'
  | 'verification_documentation'
  | 'independence_judgment';

export const SIGNOFF_DIMENSIONS: ReadonlyArray<{
  key: SignoffDimensionKey;
  label: string;
}> = [
  { key: 'safety_compliance', label: 'Safety & Compliance' },
  { key: 'technical_execution', label: 'Technical Execution' },
  { key: 'verification_documentation', label: 'Verification & Documentation' },
  { key: 'independence_judgment', label: 'Independence & Judgment' },
];

/** Per-dimension slot bundle. Both slots come from M6 — the shell only frames them. */
export interface SignoffDimensionSlots {
  /** The dimension's scored line items (M6: the `signoff_line_items` rows + their labels). */
  lineItems?: ReactNode;
  /** The dimension-level score control / rollup readout (M6 owns the scoring logic). */
  scoreControl?: ReactNode;
}

export interface SignoffFormProps extends Omit<HTMLAttributes<HTMLFormElement>, 'title'> {
  /** Header slot — evaluator/candidate context, the Work OS job reference, status, etc. */
  header?: ReactNode;
  /**
   * The four fixed-dimension slot bundles, keyed by {@link SignoffDimensionKey}. Any
   * dimension left undefined renders an on-brand placeholder in its section body. The
   * section HEADERS are always rendered (fixed by the rubric); M6 supplies the contents.
   */
  dimensions?: Partial<Record<SignoffDimensionKey, SignoffDimensionSlots>>;
  /** Evidence slot — captured field evidence against the real job (attachments, notes). */
  evidence?: ReactNode;
  /** Submit slot — the finalize/sign control(s). M6 wires the finalize-signoff behavior. */
  submit?: ReactNode;
  /** Accessible name for the form region. Default: "Evaluator sign-off rubric". */
  formLabel?: string;
}

// Token-class recipes only (D1) — no raw hex. The form is a vertical stack of Card
// sections; each dimension is a labelled fieldset so the rubric reads as a real form
// to assistive tech (the dimension header is the group's legend).
const SECTION_GAP = 'flex flex-col gap-4';
const DIM_BODY = 'flex flex-col gap-4';
const SCORE_ROW = 'flex flex-col gap-2 border-t border-line pt-4';
const FIELD_LABEL = 'font-mono text-eyebrow uppercase tracking-eyebrow text-ink-muted';

/**
 * SignoffForm — the evaluator sign-off RUBRIC layout shell (D1; M6 fills behavior).
 *
 * A declarative frame that lists the four §5.4 dimensions as FIXED section headers, each
 * exposing a `{lineItems}` slot + a `{scoreControl}` slot, plus header / evidence / submit
 * slots. This is a LAYOUT SHELL ONLY: there is NO scoring, rollup, veto, or finalize logic
 * here — that is the M6 safety-veto goal (CLAUDE.md invariant 1, a server-only computation).
 * Empty dimensions show an on-brand EmptyState placeholder so the rubric reads correctly
 * before its contents are wired. Colorblind-safe (no color-only meaning), keyboard-friendly
 * (native form + fieldset/legend), reduced-motion-safe (no animation). Forwards its ref +
 * spreads ...rest onto the <form>.
 */
export const SignoffForm = forwardRef<HTMLFormElement, SignoffFormProps>(function SignoffForm(
  {
    header,
    dimensions,
    evidence,
    submit,
    formLabel = 'Evaluator sign-off rubric',
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <form
      ref={ref}
      aria-label={formLabel}
      className={cx(SECTION_GAP, 'text-white', className)}
      {...rest}
    >
      {header != null ? <Card variant="gradient">{header}</Card> : null}

      {SIGNOFF_DIMENSIONS.map(({ key, label }) => {
        const slots = dimensions?.[key];
        const hasContent = slots?.lineItems != null || slots?.scoreControl != null;
        return (
          <Card key={key} variant="panel" padding="lg">
            {/* Fixed rubric section: the dimension name is the fieldset legend so the
                grouping is announced to screen readers. M6 fills the body slots. */}
            <fieldset className="m-0 border-0 p-0" data-dimension={key}>
              <legend className="mb-3 flex flex-col gap-1 p-0">
                <span className="font-mono text-eyebrow uppercase tracking-eyebrow text-redex-bright">
                  Dimension
                </span>
                <span className="font-display text-subtitle font-bold tracking-tighttitle text-ink-strong">
                  {label}
                </span>
              </legend>

              {hasContent ? (
                <div className={DIM_BODY}>
                  {slots?.lineItems != null ? (
                    <div className="flex flex-col gap-2">
                      <span className={FIELD_LABEL}>Line items</span>
                      {slots.lineItems}
                    </div>
                  ) : null}
                  {slots?.scoreControl != null ? (
                    <div className={SCORE_ROW}>
                      <span className={FIELD_LABEL}>Dimension score</span>
                      {slots.scoreControl}
                    </div>
                  ) : null}
                </div>
              ) : (
                <EmptyState
                  title="Awaiting rubric items"
                  description="Line items and scoring for this dimension are wired by the sign-off engine."
                />
              )}
            </fieldset>
          </Card>
        );
      })}

      {evidence != null ? (
        <Card variant="panel" padding="lg" eyebrow="Evidence" title="Field evidence">
          {evidence}
        </Card>
      ) : null}

      {children}

      {submit != null ? <div className="flex flex-col gap-2">{submit}</div> : null}
    </form>
  );
});
