import type { ReactElement, ReactNode } from 'react';
import { cx } from '../cx';
import { ToastProvider } from '../components/Toast';
import { AppHeader, type AppHeaderProps } from './AppHeader';

export type ShellDensity = 'field' | 'dense';

export interface AppShellProps extends AppHeaderProps {
  /**
   * Layout density derived from the learner's `persona` claim (Marco = `field`:
   * large-touch, roomier type for the field tech; Priya/Dana = `dense`). Persona
   * drives DENSITY ONLY — never permissions (CLAUDE.md §7). Default `dense`.
   */
  density?: ShellDensity;
  /** Changing this key cross-fades the screen (the active module/route). */
  screenKey?: string;
  /** The active screen content (a module renders here, inheriting the frame). */
  children: ReactNode;
}

/**
 * The persistent application frame (D1 §3): the dark canvas + red vignette, the
 * header (brand + nav + HUD), the cross-fading screen container, and the toast
 * layer. Every module renders INSIDE this shell and inherits the look — no screen
 * styles its own chrome. `data-density` reflects the persona so field vs dense is
 * observable + testable without touching permissions.
 */
export function AppShell({
  density = 'dense',
  screenKey = 'default',
  children,
  ...header
}: AppShellProps): ReactElement {
  return (
    <ToastProvider>
      <div
        data-density={density}
        className={cx(
          'rdx-scope rdx-canvas-vignette relative flex h-screen flex-col bg-canvas text-white',
          density === 'field' ? 'text-body-lg' : 'text-body',
        )}
      >
        <AppHeader {...header} />
        <main className="relative flex-1 overflow-auto">
          <div key={screenKey} className="rdx-anim-fadeup">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
