import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ManagerDashboard } from './ManagerDashboard';
import { StatBlock } from '../components/StatBlock';

describe('ManagerDashboard', () => {
  it('renders the default header and the empty placeholder when no table slot is given', () => {
    render(<ManagerDashboard />);
    // default eyebrow + title
    expect(screen.getByText('MANAGER')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Team');
    // on-brand EmptyState placeholder (role="status") fills the table region
    expect(screen.getByText('No team data yet')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the table slot instead of the placeholder when provided', () => {
    render(<ManagerDashboard table={<table aria-label="roster" />} />);
    expect(screen.getByLabelText('roster')).toBeInTheDocument();
    expect(screen.queryByText('No team data yet')).not.toBeInTheDocument();
  });

  it('renders the stats and filters slots in their labelled regions', () => {
    render(
      <ManagerDashboard
        filters={<button type="button">Filter</button>}
        stats={
          <>
            <StatBlock value="92%" label="Avg Mastery" />
            <StatBlock value="14" label="Active Techs" />
          </>
        }
      />,
    );
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
    expect(screen.getByText('Avg Mastery')).toBeInTheDocument();
    expect(screen.getByText('Active Techs')).toBeInTheDocument();
    // landmark regions are present for screen-reader navigation
    expect(screen.getByRole('region', { name: 'Team metrics' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Filters' })).toBeInTheDocument();
  });

  it('omits the optional filters/stats regions when their slots are not supplied', () => {
    render(<ManagerDashboard />);
    expect(screen.queryByRole('region', { name: 'Filters' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Team metrics' })).not.toBeInTheDocument();
  });

  it('supports header accent, subtitle, and actions slots', () => {
    render(
      <ManagerDashboard
        accent="Overview"
        subtitle="Across all sites"
        actions={<button type="button">Export</button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Team Overview');
    expect(screen.getByText('Across all sites')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('keeps token discipline — no raw hex in the rendered output', () => {
    const { container } = render(<ManagerDashboard />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('merges an external className onto the root section', () => {
    const { container } = render(<ManagerDashboard className="custom-x" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.tagName).toBe('SECTION');
    expect(root.className).toContain('custom-x');
  });
});
