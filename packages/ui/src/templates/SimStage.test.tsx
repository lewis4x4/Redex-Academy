import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SimStage } from './SimStage';

describe('SimStage', () => {
  it('renders the stage + side-panel landmark sections with default labels', () => {
    render(<SimStage />);
    expect(screen.getByRole('region', { name: 'Simulation' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Simulation panel' })).toBeInTheDocument();
  });

  it('mounts the {stage} slot content when provided (the F5 renderer goes here)', () => {
    render(<SimStage stage={<div data-testid="renderer">3D canvas</div>} />);
    expect(screen.getByTestId('renderer')).toBeInTheDocument();
  });

  it('shows the on-brand stage placeholder (EmptyState) when {stage} is empty', () => {
    render(<SimStage />);
    expect(screen.getByText('Simulation stage')).toBeInTheDocument();
  });

  it('shows the on-brand side-panel placeholder when no side content is supplied', () => {
    render(<SimStage stage={<div>x</div>} />);
    // role=status comes from EmptyState; the side rail placeholder headline reads "Side panel"
    expect(screen.getByText('Side panel')).toBeInTheDocument();
  });

  it('renders the objectives / feedback / telemetry sub-slots in the side rail', () => {
    const { container } = render(
      <SimStage
        objectives={<div data-testid="obj">Objectives</div>}
        feedback={<div data-testid="fb">Feedback</div>}
        telemetry={<div data-testid="tel">Telemetry</div>}
      />,
    );
    expect(screen.getByTestId('obj')).toBeInTheDocument();
    expect(screen.getByTestId('fb')).toBeInTheDocument();
    expect(screen.getByTestId('tel')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="objectives"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="feedback"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="telemetry"]')).not.toBeNull();
    // side content present => placeholder is gone
    expect(screen.queryByText('Side panel')).toBeNull();
  });

  it('renders the {sidePanel} slot directly when provided', () => {
    render(<SimStage sidePanel={<div data-testid="rail">Custom rail</div>} />);
    expect(screen.getByTestId('rail')).toBeInTheDocument();
    expect(screen.queryByText('Side panel')).toBeNull();
  });

  it('renders the optional {toolbar} as a toolbar region only when provided', () => {
    const { rerender } = render(<SimStage />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    rerender(<SimStage toolbar={<button type="button">Run</button>} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Simulation controls' });
    expect(toolbar).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument();
  });

  it('accepts custom region labels', () => {
    render(<SimStage stageLabel="IQ panel sim" sidePanelLabel="Coaching" />);
    expect(screen.getByRole('region', { name: 'IQ panel sim' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Coaching' })).toBeInTheDocument();
  });

  it('uses token classes for the responsive split and never raw hex', () => {
    const { container } = render(<SimStage data-testid="root" />);
    const root = screen.getByTestId('root');
    const grid = root.querySelector('.grid');
    expect(grid).not.toBeNull();
    // 2:1 stage/rail split kicks in at lg; single column below
    expect(grid?.className).toContain('grid-cols-1');
    expect(grid?.className).toContain('lg:grid-cols-[2fr_1fr]');
    // token discipline: no raw hex anywhere in the rendered markup
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('merges an external className and forwards its ref + rest props to the root div', () => {
    const ref = createRef<HTMLDivElement>();
    render(<SimStage ref={ref} className="custom-x" data-testid="root" />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(screen.getByTestId('root').className).toContain('custom-x');
  });
});
