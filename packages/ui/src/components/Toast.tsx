import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { cx } from '../cx';

/** A single live toast record managed by the {@link ToastProvider}. */
export interface ToastItem {
  /** Stable id (used as the React key + dismiss handle). */
  id: string;
  /** The message body. Text is ALWAYS present — status is never color-only. */
  message: ReactNode;
  /** Optional leading icon slot (decorative bolt by default). */
  icon?: ReactNode;
  /** Auto-dismiss delay in ms. `0` / negative ⇒ sticky (never auto-dismisses). */
  durationMs?: number;
}

/** What a consumer passes to `toast()` — id is assigned by the provider. */
export type ToastInput = Omit<ToastItem, 'id'> & { id?: string };

export interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  /** Leading icon slot (rendered aria-hidden). Defaults to the brand bolt. */
  icon?: ReactNode;
  /** The message body. Always rendered as text — colorblind-safe by construction. */
  children: ReactNode;
}

export interface ToastStackProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export interface ToastProviderProps {
  children: ReactNode;
  /** Fallback auto-dismiss for toasts that don't set their own `durationMs`. */
  defaultDurationMs?: number;
}

export interface ToastContextValue {
  /** Push a toast; returns its id so it can be dismissed early. */
  toast: (input: ToastInput) => string;
  /** Dismiss a specific toast by id. */
  dismiss: (id: string) => void;
  /** The live toasts (already rendered by the provider; exposed for advanced use). */
  toasts: ToastItem[];
}

/** Default auto-dismiss window (matches the prototype's 3200ms node removal). */
const DEFAULT_DURATION_MS = 3200;

/**
 * The brand bolt — the "proof-point mark" leading icon (spec §5.16, 18px,
 * `--red-bright`). Decorative: text always carries the meaning, so this is
 * aria-hidden and colorblind-safe.
 */
function BoltIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-redex-bright shrink-0"
    >
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}

// Token-class recipe (D1, spec §5.10). No raw hex — the combined toast shadow
// (`0 10px 40px rgba(0,0,0,.5), var(--glow-soft)`) is composed from CSS vars via
// arbitrary class so both the drop-shadow AND the brand halo land together.
const TOAST_CLASS =
  'inline-flex items-center gap-3 bg-grad-panel border border-redex rounded-pill ' +
  'px-[22px] py-[11px] font-label text-body-lg text-white ' +
  'shadow-[var(--shadow-toast),var(--glow-soft)] rdx-anim-fadeup pointer-events-auto';

/**
 * A single toast pill (D1, spec §5.10): `rounded-pill`, `bg-grad-panel` with a
 * `border-redex` edge, `font-label`, and the combined toast + soft-glow shadow.
 * Animates in with `rdx-anim-fadeup` (opacity-only under reduced motion).
 *
 * Colorblind-safe: the message text is the carrier of meaning; the leading bolt
 * is decorative (aria-hidden). Used standalone or rendered by {@link ToastStack}.
 */
export const Toast = forwardRef<HTMLDivElement, ToastProps>(function Toast(
  { icon, className, children, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={cx(TOAST_CLASS, className)} {...rest}>
      <span aria-hidden="true" className="inline-flex">
        {icon ?? <BoltIcon />}
      </span>
      <span>{children}</span>
    </div>
  );
});

// ToastStack is the fixed, centered live region (spec §5.10): bottom-6,
// horizontally centered, column-stacked with a 2.5 gap, above modals (z-130).
const STACK_CLASS =
  'fixed bottom-6 left-1/2 -translate-x-1/2 z-[130] flex flex-col gap-2.5 items-center ' +
  'pointer-events-none';

/**
 * The fixed bottom-center stack that hosts live toasts (spec §5.10). It is a
 * polite live region (`role="status"` + `aria-live="polite"`) so screen readers
 * announce new toasts without interrupting. Pointer events pass through the
 * stack; only the pills themselves are interactive.
 */
export const ToastStack = forwardRef<HTMLDivElement, ToastStackProps>(function ToastStack(
  { className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className={cx(STACK_CLASS, className)}
      {...rest}
    >
      {children}
    </div>
  );
});

const ToastContext = createContext<ToastContextValue | null>(null);

let toastSeq = 0;
function nextToastId(): string {
  toastSeq += 1;
  return `rdx-toast-${toastSeq}`;
}

/**
 * Provides the {@link useToast} hook and renders the live {@link ToastStack}.
 * Toasts auto-dismiss after their `durationMs` (or `defaultDurationMs`) using a
 * ref-based timer map, so timers survive re-renders and are cleared on unmount /
 * early dismiss — no leaks, no stale closures.
 */
export function ToastProvider({
  children,
  defaultDurationMs = DEFAULT_DURATION_MS,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Ref-based timer registry: id -> timeout handle. Persists across renders.
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearTimer = useCallback((id: string) => {
    const handle = timers.current.get(id);
    if (handle !== undefined) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [clearTimer],
  );

  const toast = useCallback(
    (input: ToastInput): string => {
      const id = input.id ?? nextToastId();
      const item: ToastItem = { ...input, id };
      setToasts((prev) => {
        // Replace any existing toast with the same id (idempotent re-toast).
        const without = prev.filter((t) => t.id !== id);
        return [...without, item];
      });

      const duration = item.durationMs ?? defaultDurationMs;
      clearTimer(id);
      if (duration > 0) {
        const handle = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, handle);
      }
      return id;
    },
    [defaultDurationMs, clearTimer, dismiss],
  );

  // Clear every pending timer on unmount.
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((handle) => clearTimeout(handle));
      map.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toast, dismiss, toasts }),
    [toast, dismiss, toasts],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack>
        {toasts.map((t) => (
          <Toast key={t.id} icon={t.icon}>
            {t.message}
          </Toast>
        ))}
      </ToastStack>
    </ToastContext.Provider>
  );
}

/**
 * Access the toast API. Must be called inside a {@link ToastProvider}.
 * Returns `{ toast, dismiss, toasts }`.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error('useToast must be used within a <ToastProvider>.');
  }
  return ctx;
}
