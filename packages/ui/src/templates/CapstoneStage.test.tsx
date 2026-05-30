import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CapstoneStage } from './CapstoneStage';

describe('CapstoneStage', () => {
  it('renders a labelled stage section with the decorative core-glow behind the content', () => {
    const { container } = render(<CapstoneStage title="The Final Install" />);
    const stage = screen.getByRole('region', { name: 'Capstone stage' });
    expect(stage.tagName).toBe('SECTION');
    // the brand bloom is present, decorative (aria-hidden) and non-interactive
    const glow = container.querySelector('.rdx-core-glow');
    expect(glow).not.toBeNull();
    expect(glow).toHaveAttribute('aria-hidden', 'true');
    expect(glow?.className).toContain('pointer-events-none');
    // token discipline: no raw hex ever lands in the rendered class list
    expect(stage.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('renders the title slot as a big-display <h1>', () => {
    render(<CapstoneStage title="The Final Install" />);
    const heading = screen.getByRole('heading', { level: 1, name: 'The Final Install' });
    expect(heading.className).toContain('text-display-lg');
    expect(heading.className).toContain('font-display');
  });

  it('renders the stage, cta and seal slots when supplied', () => {
    render(
      <CapstoneStage
        title="Prove One"
        stage={<div data-testid="stage-visual">scene</div>}
        cta={<button type="button">Begin walkthrough</button>}
        seal={<div data-testid="seal">earned seal</div>}
      />,
    );
    expect(screen.getByTestId('stage-visual')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Begin walkthrough' })).toBeInTheDocument();
    expect(screen.getByTestId('seal')).toBeInTheDocument();
  });

  it('shows an on-brand EmptyState placeholder for the stage when no stage slot is given', () => {
    render(<CapstoneStage title="Prove One" />);
    // EmptyState announces politely via role="status"
    const placeholder = screen.getByRole('status');
    expect(placeholder).toHaveTextContent('Stage not mounted');
    expect(placeholder).toHaveTextContent('The capstone walkthrough renders here.');
  });

  it('renders the optional eyebrow + subtitle when provided', () => {
    render(
      <CapstoneStage eyebrow="Capstone" title="Prove One" subtitle="Demonstrate the full loop." />,
    );
    expect(screen.getByText('Capstone')).toBeInTheDocument();
    expect(screen.getByText('Demonstrate the full loop.')).toBeInTheDocument();
  });

  it('merges a custom className and spreads rest props', () => {
    render(<CapstoneStage title="x" className="custom-x" data-testid="cap" />);
    const stage = screen.getByTestId('cap');
    expect(stage).toHaveClass('custom-x');
    expect(stage).toHaveAttribute('aria-label', 'Capstone stage');
  });
});
