import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Meter, ProgressBar, ProgressDots } from './Meter';

const HEX = /#[0-9a-fA-F]{3,8}/;

describe('ProgressBar', () => {
  it('exposes a progressbar role with clamped aria values on a 0..100 scale', () => {
    render(<ProgressBar value={0.42} label="Course progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Course progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('clamps out-of-range and NaN values into [0, 100]', () => {
    const { rerender } = render(<ProgressBar value={1.8} label="p" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    rerender(<ProgressBar value={-0.5} label="p" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    rerender(<ProgressBar value={Number.NaN} label="p" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('carries the grad-score fill token and no raw hex', () => {
    const { container } = render(<ProgressBar value={0.5} label="p" />);
    expect(container.innerHTML).toContain('bg-grad-score');
    expect(container.innerHTML).not.toMatch(HEX);
  });
});

describe('Meter', () => {
  it('exposes a meter role and shows the numeric label so status is not color-only', () => {
    render(<Meter value={0.82} tone="warn" ariaLabel="PoE power budget" />);
    const meter = screen.getByRole('meter', { name: 'PoE power budget: Near limit' });
    expect(meter).toHaveAttribute('aria-valuenow', '82');
    // numeric value is rendered visibly, not just encoded in the fill color
    expect(screen.getByText('82%')).toBeInTheDocument();
  });

  it('maps each tone to its token fill class (never relying on color alone)', () => {
    const { container, rerender } = render(<Meter value={0.4} tone="ok" ariaLabel="b" />);
    expect(container.innerHTML).toContain('bg-green');
    expect(screen.getByRole('meter')).toHaveAccessibleName('b: OK');

    rerender(<Meter value={0.9} tone="over" ariaLabel="b" />);
    expect(container.innerHTML).toContain('bg-redex');
    expect(screen.getByRole('meter')).toHaveAccessibleName('b: Over budget');
  });

  it('honors a custom centered label and emits no raw hex', () => {
    const { container } = render(<Meter value={0.5} tone="ok" label="9.6 / 12 W" ariaLabel="b" />);
    expect(screen.getByText('9.6 / 12 W')).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(HEX);
  });
});

describe('ProgressDots', () => {
  it('renders one labelled list item per step with shape + text, not color alone', () => {
    render(<ProgressDots label="Scenario progress" steps={['done', 'fail', 'current', 'todo']} />);
    const list = screen.getByRole('list', { name: 'Scenario progress' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveAccessibleName('Step 1: done');
    expect(items[1]).toHaveAccessibleName('Step 2: failed');
    expect(items[2]).toHaveAccessibleName('Step 3: current');
    expect(items[3]).toHaveAccessibleName('Step 4: not started');
  });

  it('carries the current-pip glow token and no raw hex', () => {
    const { container } = render(<ProgressDots steps={['done', 'current']} label="p" />);
    expect(container.innerHTML).toContain('shadow-glow');
    expect(container.innerHTML).not.toMatch(HEX);
  });
});
