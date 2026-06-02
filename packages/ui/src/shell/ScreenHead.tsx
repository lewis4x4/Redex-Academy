import type { ReactElement, ReactNode } from 'react';

export interface ScreenHeadProps {
  /** Small uppercase mono red eyebrow above the title (the v2 `.eyebrow`). */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** A red-accented trailing word in the title (e.g. title="Your" accent="Constellation"). */
  accent?: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned actions (buttons, chips). */
  actions?: ReactNode;
}

/**
 * The standard screen masthead — the v2 eyebrow · h1 · lede block (v2 spec §5). The
 * eyebrow is a mono red-bright label (the bar's `.eyebrow`: IBM Plex Mono, 3px tracking),
 * the title is the Archivo display heading (`font-display` at the bumped `text-h1`:
 * 40px / 1.04 / -1.1px tracking) in the off-white `ink-strong`, and the subtitle reads as
 * the 18px ink-muted lede. This propagates the masthead to every screen that uses it.
 */
export function ScreenHead({
  eyebrow,
  title,
  accent,
  subtitle,
  actions,
}: ScreenHeadProps): ReactElement {
  return (
    <div className="flex items-end justify-between gap-5 px-8 pb-1.5 pt-[22px]">
      <div>
        {eyebrow ? (
          <div className="font-mono text-eyebrow uppercase tracking-eyebrow text-redex-bright">
            {eyebrow}
          </div>
        ) : null}
        {/* The v2 display heading: Archivo 800 (font-display font-bold) at text-h1. */}
        <h1 className="mt-3 font-display text-h1 font-bold tracking-tighttitle text-ink-strong">
          {title}
          {accent ? <span className="text-redex"> {accent}</span> : null}
        </h1>
        {subtitle ? (
          <p className="mt-3.5 max-w-[680px] text-lede text-ink-muted">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
