import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Pip, PipRow } from './Pip';

describe('Pip', () => {
  it('renders a locked pip with a colorblind-safe text label and no ✓ glyph', () => {
    render(<Pip label="Foundations" />);
    const pip = screen.getByRole('img', { name: 'Foundations: locked' });
    expect(pip).toHaveTextContent('');
    // default (locked) fill is the neutral track token, not the brand red
    expect(pip.className).toContain('bg-track');
    expect(pip.className).not.toContain('bg-redex');
  });

  it('renders an earned pip with the ✓ glyph, brand fill + glow, and earned text label', () => {
    render(<Pip earned label="Integration" />);
    const pip = screen.getByRole('img', { name: 'Integration: earned' });
    // shape cue (✓) + color + text — never color alone
    expect(pip).toHaveTextContent('✓');
    expect(pip.className).toContain('bg-redex');
    expect(pip.className).toContain('shadow-glow');
    // token discipline: no raw hex ever lands in the rendered class list
    expect(pip.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('marks the decorative ✓ glyph aria-hidden so it is not double-announced', () => {
    render(<Pip earned label="Access Control" />);
    const glyph = screen.getByText('✓');
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
  });

  it('PipRow exposes a labelled group that contains its child pips', () => {
    render(
      <PipRow label="Foundations badges">
        <Pip earned label="Module 1" />
        <Pip label="Module 2" />
      </PipRow>,
    );
    const group = screen.getByRole('group', { name: 'Foundations badges' });
    expect(group.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    // both pips are present and individually labelled inside the group
    expect(screen.getByRole('img', { name: 'Module 1: earned' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Module 2: locked' })).toBeInTheDocument();
  });
});
