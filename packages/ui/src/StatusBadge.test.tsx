import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge (colorblind-safe primitive)', () => {
  it('carries state via TEXT (not color alone)', () => {
    render(<StatusBadge kind="safety_veto" />);
    expect(screen.getByRole('status')).toHaveTextContent('Safety veto');
  });

  it('carries state via a non-color SHAPE symbol', () => {
    render(<StatusBadge kind="fail" />);
    expect(screen.getByRole('status')).toHaveTextContent('✕');
  });

  it('exposes the verdict kind for assertions / tooling', () => {
    render(<StatusBadge kind="pass" label="Field-proven" />);
    const el = screen.getByRole('status');
    expect(el.getAttribute('data-kind')).toBe('pass');
    expect(el).toHaveTextContent('Field-proven');
  });
});
