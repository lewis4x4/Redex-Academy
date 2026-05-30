import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('renders a div wrapper with its children and the default panel token classes', () => {
    render(<Card>Body copy</Card>);
    const body = screen.getByText('Body copy');
    expect(body).toBeInTheDocument();
    // default variant = panel surface with the card radius + line border
    expect(body.className).toContain('bg-panel');
    expect(body.className).toContain('rounded-card');
    expect(body.className).toContain('border-line');
  });

  it('renders the header slot with an eyebrow + a real heading for the document outline', () => {
    render(
      <Card eyebrow="Domain" title="Access Control">
        Content
      </Card>,
    );
    const heading = screen.getByRole('heading', { level: 3, name: 'Access Control' });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText('Domain')).toBeInTheDocument();
  });

  it('omits the header slot (no heading) when neither title nor eyebrow is given', () => {
    render(<Card>Just body</Card>);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('carries the variant + padding token classes (not raw hex)', () => {
    render(
      <Card variant="glass" padding="lg" data-testid="glass">
        Lens
      </Card>,
    );
    const el = screen.getByTestId('glass');
    expect(el.className).toContain('backdrop-blur-md');
    expect(el.className).toContain('p-6');
    // token discipline: no raw hex ever lands in the rendered class list
    expect(el.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('applies the gradient panel surface for the gradient variant', () => {
    render(
      <Card variant="gradient" data-testid="grad">
        Panel
      </Card>,
    );
    const el = screen.getByTestId('grad');
    expect(el.className).toContain('bg-grad-panel');
    expect(el.className).toContain('rounded-panel');
    expect(el.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('merges an external className and forwards its ref + rest props to the div', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Card ref={ref} className="custom-x" role="group" aria-label="Score">
        x
      </Card>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    const group = screen.getByRole('group', { name: 'Score' });
    expect(group.className).toContain('custom-x');
    expect(group.className).toContain('bg-panel');
  });
});
