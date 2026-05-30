import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tag } from './Tag';

describe('Tag', () => {
  it('renders its label as a default neutral pill', () => {
    render(<Tag>Beginner</Tag>);
    const tag = screen.getByText('Beginner');
    expect(tag.tagName).toBe('SPAN');
    expect(tag.className).toContain('bg-surface-2');
    expect(tag.className).toContain('text-ink-soft');
  });

  it('carries the tier variant token classes (not raw hex)', () => {
    render(<Tag variant="tier">Pro</Tag>);
    const tag = screen.getByText('Pro');
    expect(tag.className).toContain('bg-red-tint');
    expect(tag.className).toContain('text-redex-bright');
    expect(tag.className).toContain('border-red-edge');
    // token discipline: no raw hex ever lands in the rendered class list
    expect(tag.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('prefixes the gate variant with an aria-hidden warning glyph (colorblind-safe)', () => {
    render(<Tag variant="gate">Locked</Tag>);
    const tag = screen.getByText('Locked', { exact: false });
    expect(tag.className).toContain('bg-amber-tint');
    expect(tag.className).toContain('text-amber');
    // ⚠ glyph is decorative — meaning is carried by glyph + text + color, never color alone
    expect(tag.querySelector('[aria-hidden="true"]')?.textContent).toBe('⚠');
  });

  it('renders boss as a red-bordered variant', () => {
    render(<Tag variant="boss">Boss</Tag>);
    const tag = screen.getByText('Boss');
    expect(tag.className).toContain('text-redex-bright');
    expect(tag.className).toContain('border-redex');
    expect(tag.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('renders keystone distinct from boss: gold hue + ◆ glyph', () => {
    render(<Tag variant="keystone">Keystone</Tag>);
    const tag = screen.getByText('Keystone', { exact: false });
    expect(tag.className).toContain('text-gold');
    expect(tag.className).toContain('border-gold');
    expect(tag.className).not.toContain('text-redex-bright');
    expect(tag.querySelector('[aria-hidden="true"]')?.textContent).toBe('◆');
    expect(tag.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('merges a custom className and spreads rest props', () => {
    render(
      <Tag className="custom-x" data-testid="t" aria-label="release tier">
        v2
      </Tag>,
    );
    const tag = screen.getByTestId('t');
    expect(tag).toHaveClass('custom-x');
    expect(tag).toHaveAttribute('aria-label', 'release tier');
  });
});
