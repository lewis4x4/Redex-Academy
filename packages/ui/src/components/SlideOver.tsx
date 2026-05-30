import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { cx } from '../cx';

export interface SlideOverProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Whether the panel is open (slid in). Drives the translate-x transform + scrim. */
  open: boolean;
  /** Invoked on Escape, scrim click, or close-button activation. */
  onClose: () => void;
  /** Accessible name + visible heading for the dialog. */
  title: ReactNode;
  /** Panel body. */
  children?: ReactNode;
  /**
   * Drawer scrim. Pass a custom node to override, or `false` to suppress it
   * (e.g. when a parent already renders one). Defaults to the built-in
   * drawer-variant scrim (bg-scrim-drawer, opacity-only fade).
   */
  scrim?: ReactNode | false;
}

// Token-class recipe (D1 §5.9 `#course-panel`). No raw hex — every class is backed
// by a CSS variable via the Tailwind preset. The signature value is the slide-over
// transform: `transition-transform duration-slideover ease-slide`
// (.42s cubic-bezier(.22,.9,.3,1)). z-[60] (z-60 has no preset utility).
const PANEL =
  'fixed right-0 top-0 h-full w-[min(520px,92vw)] z-[60] overflow-y-auto ' +
  'bg-grad-panel border-l border-line shadow-panel ' +
  'transition-transform duration-slideover ease-slide ' +
  'motion-reduce:transition-none';

// Drawer scrim (D1 §5.8): drawer opacity (no blur), opacity-only cross-fade.
const SCRIM =
  'fixed inset-0 z-[55] bg-scrim-drawer transition-opacity duration-screen ' +
  'motion-reduce:transition-none';

/**
 * Right slide-over panel (D1 §5.9). A modal dialog that slides in from the right
 * edge over a drawer-variant scrim. Closed = `translate-x-full` (off-screen right);
 * open = `translate-x-0`. Escape closes; clicking the scrim closes.
 *
 * a11y: `role="dialog"` + `aria-modal="true"`, labelled by its visible heading via
 * `aria-labelledby`. Native keyboard close via Escape and a real <button>. When
 * closed it is `aria-hidden` and `pointer-events-none` so it never traps focus or
 * intercepts clicks off-screen. Inherits the global brand focus ring.
 */
export const SlideOver = forwardRef<HTMLElement, SlideOverProps>(function SlideOver(
  { open, onClose, title, children, scrim, className, ...rest },
  ref,
) {
  const titleId = useId();

  // Escape-to-close (only while open).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const handleClose = useCallback(() => onClose(), [onClose]);

  // When closed, mark the off-screen panel `inert` so its focusable content (the
  // close button) is removed from the tab order AND the accessibility tree — this
  // is what satisfies axe's aria-hidden-focus rule (aria-hidden alone leaves the
  // button focusable). `inert` is not yet in this @types/react version, so spread
  // it via a typed object (no `any`) rather than a bare JSX attribute.
  const inertWhenClosed: { inert?: '' } = open ? {} : { inert: '' };

  return (
    <>
      {scrim === false ? null : scrim !== undefined ? (
        scrim
      ) : (
        <div
          aria-hidden="true"
          onClick={handleClose}
          className={cx(SCRIM, open ? 'opacity-100' : 'pointer-events-none opacity-0')}
        />
      )}
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={open ? undefined : true}
        {...inertWhenClosed}
        className={cx(
          PANEL,
          open ? 'translate-x-0' : 'pointer-events-none translate-x-full',
          className,
        )}
        {...rest}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <h2 id={titleId} className="text-title font-bold tracking-tighttitle text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className={cx(
              'inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-control',
              'bg-surface-hover border border-line text-ink-muted',
              'transition-all duration-hover hover:bg-redex hover:text-white motion-reduce:transition-none',
            )}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </aside>
    </>
  );
});
