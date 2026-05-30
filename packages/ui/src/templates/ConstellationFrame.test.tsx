import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConstellationFrame } from './ConstellationFrame';

describe('ConstellationFrame', () => {
  it('renders the dark full-bleed stage region with a default label', () => {
    const { container } = render(<ConstellationFrame />);
    const region = screen.getByRole('region', { name: 'Skill constellation' });
    expect(region).toBeInTheDocument();
    // root stage is the dark canvas, relative + full-bleed
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('bg-canvas');
    expect(root.className).toContain('relative');
    // no raw hex anywhere on the frame
    expect(root.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('shows the EmptyState placeholder when no stage slot is provided', () => {
    render(<ConstellationFrame />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Skill map coming online')).toBeInTheDocument();
  });

  it('renders the caller-provided stage slot instead of the placeholder', () => {
    render(
      <ConstellationFrame
        stage={
          <svg data-testid="skill-map" role="img" aria-label="map">
            <circle cx={1} cy={1} r={1} />
          </svg>
        }
      />,
    );
    expect(screen.getByTestId('skill-map')).toBeInTheDocument();
    // placeholder is suppressed once the stage is filled
    expect(screen.queryByText('Skill map coming online')).toBeNull();
  });

  it('renders the default node-state legend (colorblind-safe: shape + text)', () => {
    const { container } = render(<ConstellationFrame />);
    // all five node states are labelled by text, not color alone
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Mastered')).toBeInTheDocument();
    expect(screen.getByText('Boss')).toBeInTheDocument();
    const legend = container.querySelector('[data-slot="legend"]');
    expect(legend).not.toBeNull();
    expect(legend?.querySelectorAll('li')).toHaveLength(5);
  });

  it('replaces the default legend with a custom legend slot', () => {
    render(<ConstellationFrame legend={<p>Custom legend</p>} />);
    expect(screen.getByText('Custom legend')).toBeInTheDocument();
    expect(screen.queryByText('Node states')).toBeNull();
  });

  it('hides the legend entirely when legend is null', () => {
    const { container } = render(<ConstellationFrame legend={null} />);
    expect(container.querySelector('[data-slot="legend"]')).toBeNull();
    expect(screen.queryByText('Node states')).toBeNull();
  });

  it('renders the lens panel slot in a glass overlay only when provided', () => {
    const { container, rerender } = render(<ConstellationFrame />);
    expect(container.querySelector('[data-slot="lens-panel"]')).toBeNull();

    rerender(<ConstellationFrame lensPanel={<button type="button">Intrusion</button>} />);
    expect(screen.getByRole('button', { name: 'Intrusion' })).toBeInTheDocument();
    expect(container.querySelector('[data-slot="lens-panel"]')).not.toBeNull();
  });

  it('uses a custom stage label, merges className, and forwards its ref', () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <ConstellationFrame ref={ref} className="custom-x" stageLabel="My map" />,
    );
    expect(ref.current).toBe(container.firstElementChild);
    expect((container.firstElementChild as HTMLElement).className).toContain('custom-x');
    expect(screen.getByRole('region', { name: 'My map' })).toBeInTheDocument();
  });
});
