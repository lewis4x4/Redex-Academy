import type { ReactElement, ReactNode } from 'react';

export interface ScreenHeadProps {
  /** Small uppercase red eyebrow above the title. */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** A red-accented trailing word in the title (e.g. title="Your" accent="Constellation"). */
  accent?: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned actions (buttons, chips). */
  actions?: ReactNode;
}

/** The standard screen header (D1 §6.3 `.screen-head`): eyebrow · h1 (negative
 *  tracking, optional red accent) · muted subtitle · right-aligned actions. */
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
          <div className="text-eyebrow font-label uppercase tracking-eyebrow text-redex-bright">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-h1 font-bold tracking-tighttitle">
          {title}
          {accent ? <span className="text-redex"> {accent}</span> : null}
        </h1>
        {subtitle ? (
          <p className="mt-1 max-w-[680px] text-body text-ink-muted">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
