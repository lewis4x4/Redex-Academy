import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScoreValue, StatBlock } from './StatBlock';

describe('StatBlock', () => {
  it('renders the value and label text', () => {
    render(<StatBlock value="92%" label="Accuracy" />);
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('Accuracy')).toBeInTheDocument();
  });

  it('carries the HUD value/label token classes (not raw hex)', () => {
    const { container } = render(<StatBlock value="3" label="Streak" />);
    const root = container.firstElementChild as HTMLElement;
    // value tier
    expect(screen.getByText('3').className).toContain('text-stat');
    expect(screen.getByText('3').className).toContain('font-bold');
    // label tier: micro + tracked + uppercase + muted
    const label = screen.getByText('Streak');
    expect(label.className).toContain('text-micro');
    expect(label.className).toContain('tracking-label');
    expect(label.className).toContain('uppercase');
    expect(label.className).toContain('text-ink-muted');
    // default align = end
    expect(root.className).toContain('items-end');
    // token discipline: no raw hex ever lands in the rendered class list
    expect(root.outerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('applies the accent (red-bright) token only when accent is set', () => {
    const { rerender } = render(<StatBlock value="V" label="L" />);
    expect(screen.getByText('V').className).not.toContain('text-redex-bright');
    rerender(<StatBlock value="V" label="L" accent />);
    expect(screen.getByText('V').className).toContain('text-redex-bright');
  });

  it('supports start alignment', () => {
    const { container } = render(<StatBlock value="1" label="x" align="start" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('items-start');
  });
});

describe('ScoreValue', () => {
  it('renders the display-weight value with an optional unit and label (no raw hex)', () => {
    const { container } = render(<ScoreValue value="92" unit="%" label="Final Score" />);
    const root = container.firstElementChild as HTMLElement;
    expect(screen.getByText('92').className).toContain('text-display');
    expect(screen.getByText('92').className).toContain('font-display');
    expect(screen.getByText('%').className).toContain('text-ink-muted');
    expect(screen.getByText('Final Score')).toBeInTheDocument();
    expect(root.outerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('omits the unit and label nodes when not provided', () => {
    render(<ScoreValue value="100" />);
    expect(screen.getByText('100')).toBeInTheDocument();
    // only the value span — no label node rendered
    expect(screen.queryByText('Final Score')).not.toBeInTheDocument();
  });
});
