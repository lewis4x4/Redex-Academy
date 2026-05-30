import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Chip, Tab } from './Chip';

describe('Chip', () => {
  it('renders a native button with its label and a default type of button', () => {
    render(<Chip>4-Port</Chip>);
    const chip = screen.getByRole('button', { name: '4-Port' });
    expect(chip).toHaveAttribute('type', 'button');
  });

  it('exposes selection beyond color via aria-pressed (colorblind-safe state)', () => {
    const { rerender } = render(<Chip>Dome</Chip>);
    expect(screen.getByRole('button', { name: 'Dome' })).toHaveAttribute('aria-pressed', 'false');
    rerender(<Chip selected>Dome</Chip>);
    expect(screen.getByRole('button', { name: 'Dome' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('carries the selected red-tint token (default variant) and no raw hex', () => {
    render(<Chip selected>Bullet</Chip>);
    const chip = screen.getByRole('button', { name: 'Bullet' });
    // Selected default chip uses the translucent red-tint + red-edge + white treatment
    // (the active-NavPill recipe) so it passes WCAG AA on the dark canvas.
    expect(chip.className).toContain('bg-red-tint');
    expect(chip.className).toContain('border-red-edge');
    expect(chip.className).toContain('text-white');
    expect(chip.className).toContain('shadow-glow-soft');
    expect(chip.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('uses the GOLD lens accent for the persona variant when selected', () => {
    render(
      <Chip variant="persona" selected>
        Field Tech
      </Chip>,
    );
    const chip = screen.getByRole('button', { name: 'Field Tech' });
    expect(chip.className).toContain('border-gold');
    expect(chip.className).toContain('text-gold');
    // not the red default fill
    expect(chip.className).not.toContain('bg-redex');
    expect(chip.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('is disabled-aware and merges a passed className', () => {
    render(
      <Chip disabled className="custom-x">
        Off
      </Chip>,
    );
    const chip = screen.getByRole('button', { name: 'Off' });
    expect(chip).toBeDisabled();
    expect(chip.className).toContain('custom-x');
  });
});

describe('Tab', () => {
  it('renders with the tab role and reflects active state via aria-selected', () => {
    const { rerender } = render(<Tab>Schematic</Tab>);
    const tab = screen.getByRole('tab', { name: 'Schematic' });
    expect(tab).toHaveAttribute('type', 'button');
    expect(tab).toHaveAttribute('aria-selected', 'false');
    rerender(<Tab active>Schematic</Tab>);
    expect(screen.getByRole('tab', { name: 'Schematic' })).toHaveAttribute('aria-selected', 'true');
  });

  it('carries the panel fill token when active and no raw hex', () => {
    render(<Tab active>Code</Tab>);
    const tab = screen.getByRole('tab', { name: 'Code' });
    expect(tab.className).toContain('bg-panel');
    expect(tab.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('renders the 3px red underline bar only when active (decorative, aria-hidden)', () => {
    const { container, rerender } = render(<Tab>Diagram</Tab>);
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
    rerender(<Tab active>Diagram</Tab>);
    const bar = container.querySelector('[aria-hidden="true"]');
    expect(bar).not.toBeNull();
    expect(bar?.className).toContain('bg-redex');
  });
});
