import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';

export interface SimulatorPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** The embedded sim renderer (the engine supplies its own SimFrame + StateBadge). */
  children: ReactNode;
}

/**
 * SimulatorPanel — a DOM-only frame (D1) that elevates an embedded lesson sim to the
 * step's centerpiece (the mockup's pick-cards / wiring-schematic surface). It wraps the
 * existing engine renderer in the brand sim panel (`rounded-panel` + `border-red-edge`
 * + `bg-grad-panel` + `shadow-panel`) and adds NOTHING else: no engine, scoring,
 * telemetry, verdict, or testid changes — the inner StateBadge's `role="status"` and the
 * engine's submit/missing/unsupported testids are untouched. Carries no vertical margin
 * (the step container supplies the gap) so it never double-stacks spacing. Token classes
 * only; no raw hex.
 */
export const SimulatorPanel = forwardRef<HTMLDivElement, SimulatorPanelProps>(
  function SimulatorPanel({ children, className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        data-testid="simulator-panel"
        className={cx(
          'rounded-panel border border-red-edge bg-grad-panel p-5 shadow-panel',
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
