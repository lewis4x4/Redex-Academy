import {
  forwardRef,
  useCallback,
  useId,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import { cx } from '../cx';
import { useFocusTrap } from '../useFocusTrap';

export type ScrimVariant = 'modal' | 'drawer';

export interface ScrimProps extends HTMLAttributes<HTMLDivElement> {
  /** `modal` = darker (.7) + blur; `drawer` = lighter (.5) slide-over scrim. */
  variant?: ScrimVariant;
}

export interface ModalProps {
  /** Whether the dialog is mounted + visible. When false, nothing renders. */
  open: boolean;
  /** Called on Escape, scrim click, or close affordance. */
  onClose: () => void;
  /** Accessible name for the dialog; wired to `aria-labelledby`. */
  title: string;
  /** Optional extra classes merged onto the dialog card via cx(). */
  className?: string;
  children?: ReactNode;
}

// Token-class recipes (D1 §5.8). No raw hex — every class is backed by a CSS
// variable via the Tailwind preset. The two scrim opacities coexist in the
// prototype: modal = scrim-modal (.7) + blur, drawer = scrim-drawer (.5) no blur.
const SCRIM: Record<ScrimVariant, string> = {
  modal: 'bg-scrim-modal backdrop-blur-[6px]',
  drawer: 'bg-scrim-drawer',
};

/**
 * The dimming scrim behind modals + slide-over drawers (D1 §5.8). Decorative by
 * default (the dialog owns the a11y semantics); spread `...rest` to add an
 * onClick that dismisses, or aria attributes if used standalone.
 */
export const Scrim = forwardRef<HTMLDivElement, ScrimProps>(function Scrim(
  { variant = 'modal', className, ...rest },
  ref,
) {
  return <div ref={ref} className={cx('absolute inset-0', SCRIM[variant], className)} {...rest} />;
});

/**
 * Centered modal dialog (D1 §5.8). `role="dialog"` + `aria-modal`, labelled by
 * its title, Escape-to-close, scrim-click-to-close, and a real focus trap (via
 * {@link useFocusTrap}): focus moves into the dialog on open, Tab/Shift+Tab cycle
 * within it, and focus is restored to the trigger on close. The card is the 180deg
 * panel gradient with the modal shadow and the fadeUp entrance (auto-disabled under
 * prefers-reduced-motion).
 */
export const Modal = forwardRef<HTMLDivElement, ModalProps>(function Modal(
  { open, onClose, title, className, children },
  ref,
) {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Trap focus inside the dialog while open (moves focus in on open, cycles
  // Tab/Shift+Tab within the card, and restores focus to the trigger on close).
  useFocusTrap(cardRef, open);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    },
    [onClose],
  );

  const setCardRef = useCallback(
    (node: HTMLDivElement | null) => {
      cardRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [ref],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      <Scrim variant="modal" onClick={onClose} />
      <div
        ref={setCardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'relative z-[1] w-[min(680px,92vw)] max-h-[84vh] overflow-y-auto outline-none',
          'bg-grad-panel border border-line rounded-panel shadow-modal rdx-anim-fadeup',
          className,
        )}
      >
        <h2
          id={titleId}
          className="px-[26px] pt-[26px] pb-3 text-title font-display font-bold tracking-tighttitle text-white"
        >
          {title}
        </h2>
        <div className="px-[26px] pb-[26px]">{children}</div>
      </div>
    </div>
  );
});
