import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CatalogGrid } from './CatalogGrid';

describe('CatalogGrid', () => {
  it('renders the header + filter slots and the course cards in a grid', () => {
    render(
      <CatalogGrid header={<h1>Catalog</h1>} filters={<button>All domains</button>}>
        <article data-testid="card-1">AC-101</article>
        <article data-testid="card-2">AC-102</article>
      </CatalogGrid>,
    );
    expect(screen.getByRole('heading', { name: 'Catalog' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All domains' })).toBeInTheDocument();
    const card = screen.getByTestId('card-1');
    expect(card).toBeInTheDocument();
    // the cards live inside the grid container (not the empty placeholder)
    expect(card.parentElement?.className).toContain('grid');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('applies an auto-fill minmax grid track sized to minColumnWidth', () => {
    render(
      <CatalogGrid minColumnWidth={320} data-testid="grid">
        <article>card</article>
      </CatalogGrid>,
    );
    const card = screen.getByText('card');
    const grid = card.parentElement as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(auto-fill, minmax(320px, 1fr))');
  });

  it('shows the on-brand EmptyState (not an empty grid) when there are no cards', () => {
    render(<CatalogGrid emptyLabel="No published courses" />);
    const region = screen.getByRole('status');
    expect(region).toBeInTheDocument();
    expect(screen.getByText('No published courses')).toBeInTheDocument();
    // token discipline: no raw hex ever lands in the rendered class list
    expect(region.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('renders the EmptyState description when provided', () => {
    render(
      <CatalogGrid
        emptyLabel="Nothing here"
        emptyDescription="Published courses will appear here."
      />,
    );
    expect(screen.getByText('Published courses will appear here.')).toBeInTheDocument();
  });

  it('omits the header + filter slots when they are not supplied', () => {
    render(
      <CatalogGrid>
        <article>only a card</article>
      </CatalogGrid>,
    );
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('only a card')).toBeInTheDocument();
  });

  it('merges an external className and forwards its ref + rest props to the section', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <CatalogGrid ref={ref} className="custom-x" aria-label="Course catalog">
        <article>x</article>
      </CatalogGrid>,
    );
    expect(ref.current).toBeInstanceOf(HTMLElement);
    const section = screen.getByLabelText('Course catalog');
    expect(section.tagName).toBe('SECTION');
    expect(section.className).toContain('custom-x');
    expect(section.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});
