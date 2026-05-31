import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Callout } from './Callout';
import { Checklist } from './Checklist';

describe('Callout — MDX safety call-out (colorblind-safe)', () => {
  it('renders as a note region with a visible tone WORD (not color alone) + body', () => {
    render(
      <Callout tone="safety" label="Safety">
        Mag locks must release on power loss.
      </Callout>,
    );
    const note = screen.getByRole('note');
    expect(note).toHaveAttribute('data-tone', 'safety');
    // the tone word carries meaning for colorblind users; the glyph is decorative
    expect(note).toHaveTextContent('Safety');
    expect(note).toHaveTextContent('Mag locks must release on power loss.');
  });

  it('defaults the tone word when no label is given', () => {
    render(<Callout tone="warning">Check the gauge.</Callout>);
    expect(screen.getByRole('note')).toHaveTextContent('Caution');
  });
});

describe('Checklist — read-only verification list', () => {
  it('renders a labelled list; each row state is glyph + text (not color alone)', () => {
    render(
      <Checklist
        ariaLabel="Pre-power checklist"
        items={[
          { id: 'a', label: 'Confirm fail-safe', done: true },
          { id: 'b', label: 'Verify REX' },
        ]}
      />,
    );
    expect(screen.getByRole('list', { name: 'Pre-power checklist' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Done:')).toBeInTheDocument(); // sr-only state text
    expect(screen.getByText('To do:')).toBeInTheDocument();
  });
});
