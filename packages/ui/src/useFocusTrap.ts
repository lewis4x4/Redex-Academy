import { useEffect, type RefObject } from 'react';

// The focusable-descendant selector (D1 a11y). Matches the standard tabbable set:
// links with an href, enabled form controls + buttons, and anything with an
// explicit non-negative tabindex. Elements with tabindex="-1" are programmatically
// focusable but NOT part of the Tab order, so they are excluded as cycle stops.
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Collect the container's focusable descendants in DOM (tab) order. */
function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * useFocusTrap — a reusable focus trap for modal-style overlays (D1 a11y).
 *
 * While `active` is true it:
 *  1. captures `document.activeElement` (the trigger) at activation time,
 *  2. moves focus to the first focusable descendant of `containerRef` (or the
 *     container itself if it has none, so keyboard users still land inside),
 *  3. traps Tab / Shift+Tab so focus cycles within the container — wrapping from
 *     the last focusable back to the first (and vice-versa), treating the
 *     container as a boundary,
 *  4. on deactivate/unmount, RESTORES focus to the captured trigger (guarded for
 *     a null or since-removed trigger).
 *
 * SSR-safe (guards `document`); no `any`; tears down its keydown listener cleanly.
 *
 * @param containerRef ref to the trapping container (e.g. the dialog card/panel)
 * @param active       whether the trap is engaged
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (typeof document === 'undefined') return;
    const container = containerRef.current;
    if (container === null) return;

    // 1. Remember whatever held focus before we activated (the trigger). It may
    //    be null or get removed from the DOM by the time we restore — both guarded.
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // 2. Move focus into the container: first focusable descendant, else the
    //    container itself (callers give it tabIndex={-1} so this always works).
    const initial = getFocusable(container);
    if (initial.length > 0) {
      initial[0]?.focus();
    } else {
      container.focus();
    }

    // 3. Trap Tab / Shift+Tab so focus cycles within the container.
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return;
      const focusable = getFocusable(container);

      // No focusable descendants: keep focus pinned on the container boundary.
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;
      const activeEl = document.activeElement;

      if (event.shiftKey) {
        // Shift+Tab on the first (or focus already outside the cycle) → wrap to last.
        if (activeEl === first || !container.contains(activeEl)) {
          event.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !container.contains(activeEl)) {
        // Tab on the last (or focus outside) → wrap to first.
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // 4. Restore focus to the trigger, guarding for null / removed-from-DOM.
      if (previouslyFocused !== null && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [active, containerRef]);
}
