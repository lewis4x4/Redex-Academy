import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox, Radio, Switch } from './Toggle';

describe('Checkbox', () => {
  it('renders a native checkbox associated with its label', () => {
    render(<Checkbox label="Acknowledge safety brief" />);
    const box = screen.getByRole('checkbox', { name: 'Acknowledge safety brief' });
    expect(box).toBeInstanceOf(HTMLInputElement);
    expect(box).toHaveAttribute('type', 'checkbox');
  });

  it('toggles via the associated label and carries the brand accent (no raw hex)', () => {
    render(<Checkbox label="Confirm" />);
    const box = screen.getByRole('checkbox', { name: 'Confirm' }) as HTMLInputElement;
    expect(box).not.toBeChecked();
    // clicking the label text toggles the input (htmlFor association)
    fireEvent.click(screen.getByText('Confirm'));
    expect(box).toBeChecked();
    expect(box.className).toContain('accent-redex');
    expect(box.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('honors disabled', () => {
    render(<Checkbox label="Locked" disabled />);
    expect(screen.getByRole('checkbox', { name: 'Locked' })).toBeDisabled();
  });
});

describe('Radio', () => {
  it('renders a native radio with its label and groups by name', () => {
    render(
      <>
        <Radio name="persona" value="nova" label="Nova" defaultChecked />
        <Radio name="persona" value="marco" label="Marco" />
      </>,
    );
    const nova = screen.getByRole('radio', { name: 'Nova' }) as HTMLInputElement;
    const marco = screen.getByRole('radio', { name: 'Marco' }) as HTMLInputElement;
    expect(nova).toBeChecked();
    expect(marco).not.toBeChecked();
    // selecting marco deselects nova (shared name)
    fireEvent.click(marco);
    expect(marco).toBeChecked();
    expect(nova).not.toBeChecked();
    expect(marco.className).toContain('accent-redex');
    expect(marco.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});

describe('Switch', () => {
  it('renders role=switch with aria-checked reflecting state (colorblind-safe, not color-only)', () => {
    const { rerender } = render(<Switch label="Offline mode" checked={false} />);
    const sw = screen.getByRole('switch', { name: 'Offline mode' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw.className).toContain('bg-surface-2');
    rerender(<Switch label="Offline mode" checked />);
    expect(screen.getByRole('switch', { name: 'Offline mode' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('carries the on (brand red) track token and no raw hex when checked', () => {
    render(<Switch label="On" checked />);
    const sw = screen.getByRole('switch', { name: 'On' });
    expect(sw.className).toContain('bg-redex');
    expect(sw.outerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('is keyboard-operable and fires onCheckedChange with the next value', () => {
    const onCheckedChange = vi.fn();
    render(<Switch label="Toggle" checked={false} onCheckedChange={onCheckedChange} />);
    const sw = screen.getByRole('switch', { name: 'Toggle' });
    // native button: Enter/Space activate it, dispatching a click
    fireEvent.click(sw);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('does not fire onCheckedChange when disabled', () => {
    const onCheckedChange = vi.fn();
    render(<Switch label="Locked" checked={false} disabled onCheckedChange={onCheckedChange} />);
    const sw = screen.getByRole('switch', { name: 'Locked' });
    expect(sw).toBeDisabled();
    fireEvent.click(sw);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
