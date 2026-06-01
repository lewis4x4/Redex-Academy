import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SimulatorPanel } from './SimulatorPanel';

const HEX = /#[0-9a-fA-F]{3,8}/;

describe('SimulatorPanel', () => {
  it('frames its children in the brand sim panel tokens (no engine/testid of its own beyond the wrapper)', () => {
    render(
      <SimulatorPanel>
        <button data-testid="i2d-submit">Submit</button>
      </SimulatorPanel>,
    );
    // the child renderer is passed through untouched
    expect(screen.getByTestId('i2d-submit')).toBeInTheDocument();
    const panel = screen.getByTestId('simulator-panel');
    expect(panel).toContainElement(screen.getByTestId('i2d-submit'));
  });

  it('carries the centerpiece frame tokens and emits no raw hex / no vertical margin', () => {
    const { container } = render(
      <SimulatorPanel>
        <span>sim</span>
      </SimulatorPanel>,
    );
    const html = container.innerHTML;
    expect(html).toContain('rounded-panel');
    expect(html).toContain('border-red-edge');
    expect(html).toContain('bg-grad-panel');
    expect(html).toContain('shadow-panel');
    // no vertical margin (the step container supplies the gap — avoid double-stacking)
    expect(html).not.toMatch(/\bmy-\d/);
    expect(html).not.toMatch(HEX);
  });
});
