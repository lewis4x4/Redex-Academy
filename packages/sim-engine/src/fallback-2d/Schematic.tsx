import type { ReactElement, ReactNode } from 'react';

export type RenderMode = 'rich' | 'fallback2d';

export interface SimFrameProps {
  mode: RenderMode;
  title: string;
  children: ReactNode;
}

/**
 * Shared frame for both renderers. The 2D "picture-book" fallback (F5 §5) is a
 * FIRST-CLASS path, not a degraded mode: it renders the SAME controls driving the
 * SAME SimInstance — only the presentation differs (high-contrast schematic, no
 * heavy media). Because both modes drive one instance, the Verdict/score is
 * identical by construction (DRY_RUN red flag: never a different score in 2D).
 */
export function SimFrame({ mode, title, children }: SimFrameProps): ReactElement {
  const cls =
    mode === 'fallback2d'
      ? 'rounded-md border-2 border-slate-900 bg-white p-4 text-slate-900'
      : 'rounded-md border border-slate-200 bg-white p-4 text-slate-900 shadow-sm';
  return (
    <section data-render-mode={mode} className={cls}>
      <h2
        className={
          mode === 'fallback2d'
            ? 'font-mono text-sm uppercase tracking-wide'
            : 'text-lg font-semibold'
        }
      >
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}
