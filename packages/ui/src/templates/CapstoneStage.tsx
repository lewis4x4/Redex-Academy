import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';
import { EmptyState } from '../components/States';

export interface CapstoneStageProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * The cinematic stage slot — the centered hero visual (a 3D scene mount, the
   * Constellation core, a recorded fixture frame, etc.). C1 fills this with the
   * capstone walkthrough; here it is a frame only. When omitted, an on-brand
   * EmptyState placeholder renders in its place.
   */
  stage?: ReactNode;
  /**
   * The big display-type title for the stage (the capstone name / call to begin).
   * Rendered in a native <h1> so the document outline stays correct.
   */
  title?: ReactNode;
  /** Small uppercase red eyebrow above the title (optional). */
  eyebrow?: ReactNode;
  /** Muted supporting line beneath the title (optional). */
  subtitle?: ReactNode;
  /**
   * The primary call-to-action slot — pass a <Button variant="cta"/> (the
   * full-width launch button) or a "begin"-scale control. Centered beneath the copy.
   */
  cta?: ReactNode;
  /**
   * Optional completion-seal slot — the earned capstone seal/medal, shown when the
   * walkthrough is complete (C1 supplies it). Pinned to the top of the stage so it
   * reads as an award stamp over the scene.
   */
  seal?: ReactNode;
}

// Token-class recipes (D1) — NO raw hex. The stage is a centered hero region on the
// dark canvas: the `.rdx-core-glow` red bloom sits behind the content as a fixed,
// decorative layer (aria-hidden, pointer-events-none) so it never traps focus or
// blocks clicks. All depth comes from token surfaces/glows; the only motion is the
// reduced-motion-safe `.rdx-anim-fadeup` entrance (auto-disabled under
// prefers-reduced-motion via the library's single guard).
const ROOT =
  'relative flex min-h-[60vh] w-full flex-col items-center justify-center overflow-hidden ' +
  'rounded-panel border border-line bg-canvas px-6 py-16 text-center text-white';

const GLOW = 'rdx-core-glow pointer-events-none absolute inset-0 z-0';

const CONTENT =
  'rdx-anim-fadeup relative z-10 flex w-full max-w-[640px] flex-col items-center gap-5';

/**
 * CapstoneStage — the capstone cinematic stage shell (D1; C1 fills the walkthrough).
 *
 * A LAYOUT SHELL ONLY: a dramatic centered stage on the dark canvas with the
 * `.rdx-core-glow` red bloom behind it, and four named slots — {stage} (the hero
 * visual), {title} (big display type), {cta} (a launch Button), and an optional
 * {seal} (the completion seal). No walkthrough logic, data, or state lives here;
 * those arrive later via C1.
 *
 * Colorblind-safe (no meaning carried by hue alone — copy + the explicit CTA do the
 * work), keyboard-friendly (the CTA/seal are whatever interactive nodes you pass in,
 * each keeping the global focus ring), and reduced-motion-safe (only the gated
 * `.rdx-anim-*` entrance animates). Forwards its ref + spreads ...rest; merges an
 * external className via cx. When `stage`/`title`/`cta` are absent, on-brand
 * EmptyState placeholders render so the frame is presentable before C1 lands.
 */
export const CapstoneStage = forwardRef<HTMLDivElement, CapstoneStageProps>(function CapstoneStage(
  { stage, title, eyebrow, subtitle, cta, seal, className, ...rest },
  ref,
) {
  return (
    <section ref={ref} aria-label="Capstone stage" className={cx(ROOT, className)} {...rest}>
      {/* Decorative red core-glow bloom — behind the content, never interactive. */}
      <div aria-hidden="true" className={GLOW} />

      <div className={CONTENT}>
        {/* Completion seal — an award stamp pinned above the stage when supplied. */}
        {seal != null ? <div className="inline-flex">{seal}</div> : null}

        {/* The cinematic stage visual (C1 mounts the walkthrough here). */}
        <div className="w-full">
          {stage != null ? (
            stage
          ) : (
            <EmptyState
              title="Stage not mounted"
              description="The capstone walkthrough renders here."
            />
          )}
        </div>

        {/* Title block — eyebrow · big display h1 · muted subtitle. */}
        <div className="flex flex-col items-center gap-2">
          {eyebrow != null ? (
            <span className="text-eyebrow font-label uppercase tracking-eyebrow text-redex">
              {eyebrow}
            </span>
          ) : null}
          {title != null ? (
            <h1 className="text-display-lg font-display tracking-tighttitle text-white">{title}</h1>
          ) : (
            <h1 className="text-display-lg font-display tracking-tighttitle text-ink-muted">
              Capstone title
            </h1>
          )}
          {subtitle != null ? (
            <p className="max-w-[42ch] text-body-lg text-ink-muted">{subtitle}</p>
          ) : null}
        </div>

        {/* Primary CTA slot — the launch / begin button lives here. */}
        <div className="flex w-full max-w-[320px] flex-col items-center">
          {cta != null ? (
            cta
          ) : (
            <p className="text-caption text-ink-dim">Primary action goes here</p>
          )}
        </div>
      </div>
    </section>
  );
});
