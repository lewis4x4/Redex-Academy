import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrophyMedal } from './TrophyMedal';

describe('TrophyMedal', () => {
  it('renders an img-role card whose accessible label states "earned" + the name (not color alone)', () => {
    render(<TrophyMedal domain="VID" earned name="PoE Power Budget" />);
    const medal = screen.getByRole('img', { name: 'Earned trophy: PoE Power Budget' });
    expect(medal.tagName).toBe('DIV');
    // earned brand surface: red-tint fill, brand border, soft glow + hover lift
    expect(medal.className).toContain('bg-red-tint');
    expect(medal.className).toContain('border-redex');
    expect(medal.className).toContain('shadow-glow-soft');
    // colorblind/token discipline: no raw hex ever lands in the rendered class list
    expect(medal.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('locked state: dim surface, no glow, a 🔒 overlay, and "Locked" in the label', () => {
    render(<TrophyMedal domain="SEC" earned={false} name="Arming Sequences" />);
    const medal = screen.getByRole('img', { name: 'Locked trophy: Arming Sequences' });
    expect(medal.className).toContain('bg-surface-1');
    expect(medal.className).toContain('border-line');
    expect(medal.className).not.toContain('shadow-glow-soft');
    // shape cue, not color alone: a decorative lock glyph marks the locked state
    const lock = medal.querySelector('[aria-hidden="true"]');
    expect(lock?.textContent).toBe('🔒');
    expect(medal.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('applies the domain hue token to the card (text-domain-*)', () => {
    render(<TrophyMedal domain="ADC" earned name="Partner Portal" />);
    const medal = screen.getByRole('img', { name: 'Earned trophy: Partner Portal' });
    expect(medal.className).toContain('text-domain-adc');
  });

  it('renders a decorative 48x48 medal SVG (aria-hidden, not exposed to AT)', () => {
    const { container } = render(<TrophyMedal domain="FND" earned name="Foundations" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('width', '48');
    expect(svg).toHaveAttribute('height', '48');
    // earned medal uses gold star + brand disc fill; stroke inherits the domain hue
    expect(svg?.querySelector('.fill-gold')).not.toBeNull();
    expect(svg?.querySelector('.fill-redex')).not.toBeNull();
  });

  it('locked medal is dimmed and uses the grey locked stroke (not the domain hue)', () => {
    const { container } = render(<TrophyMedal domain="INT" earned={false} name="Integration" />);
    const svg = container.querySelector('svg');
    expect(svg?.className.baseVal).toContain('opacity-30');
    expect(svg?.querySelector('.stroke-domain-locked')).not.toBeNull();
    expect(svg?.querySelector('.stroke-current')).toBeNull();
  });

  it('merges a custom className and spreads rest props', () => {
    render(
      <TrophyMedal
        domain="AC"
        earned
        name="Access Control"
        className="custom-x"
        data-testid="tm"
      />,
    );
    const medal = screen.getByTestId('tm');
    expect(medal).toHaveClass('custom-x');
    expect(medal).toHaveAttribute('role', 'img');
  });
});
