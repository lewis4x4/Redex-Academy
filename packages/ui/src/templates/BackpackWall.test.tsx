import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BackpackWall } from './BackpackWall';
import { TrophyMedal } from '../components/TrophyMedal';
import { StatBlock } from '../components/StatBlock';
import { Chip } from '../components/Chip';

describe('BackpackWall', () => {
  it('renders a labelled region for the backpack', () => {
    render(<BackpackWall />);
    expect(screen.getByRole('region', { name: 'Digital backpack' })).toBeInTheDocument();
  });

  it('shows the on-brand empty placeholder when no medals are passed', () => {
    render(<BackpackWall />);
    // EmptyState announces politely via role="status".
    const empty = screen.getByRole('status');
    expect(empty).toHaveTextContent('Your backpack is empty');
    // No trophy grid is rendered while empty.
    expect(screen.queryByRole('list', { name: 'Earned trophies' })).toBeNull();
  });

  it('renders a custom emptyState slot instead of the default when empty', () => {
    render(<BackpackWall emptyState={<div>Nothing earned yet</div>} />);
    expect(screen.getByText('Nothing earned yet')).toBeInTheDocument();
    expect(screen.queryByText('Your backpack is empty')).toBeNull();
  });

  it('renders the trophy grid (children) and hides the empty placeholder', () => {
    render(
      <BackpackWall>
        <TrophyMedal domain="AC" earned name="Door Reader" />
        <TrophyMedal domain="VID" earned={false} name="PPF Master" />
      </BackpackWall>,
    );
    const grid = screen.getByRole('list', { name: 'Earned trophies' });
    expect(grid).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Earned trophy: Door Reader' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Locked trophy: PPF Master' })).toBeInTheDocument();
    expect(screen.queryByText('Your backpack is empty')).toBeNull();
  });

  it('renders the header, stats, and domain filter slots', () => {
    render(
      <BackpackWall
        header={<h2>My Backpack</h2>}
        stats={<StatBlock value="3" label="Badges earned" />}
        filters={<Chip>All-Clear (AC)</Chip>}
      >
        <TrophyMedal domain="AC" earned name="Door Reader" />
      </BackpackWall>,
    );
    expect(screen.getByRole('heading', { name: 'My Backpack' })).toBeInTheDocument();
    expect(screen.getByText('Badges earned')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Filter trophies by domain' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All-Clear (AC)' })).toBeInTheDocument();
  });

  it('merges a passed className and uses token classes only (no raw hex)', () => {
    const { container } = render(<BackpackWall className="custom-x" />);
    const region = screen.getByRole('region', { name: 'Digital backpack' });
    expect(region.className).toContain('custom-x');
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});
