import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders a native button with its label and a default type of button', () => {
    render(<Button>Launch</Button>);
    const btn = screen.getByRole('button', { name: 'Launch' });
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('is disabled-aware and carries the variant token classes (not raw hex)', () => {
    render(
      <Button variant="cta" disabled>
        Go
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Go' });
    expect(btn).toBeDisabled();
    expect(btn.className).toContain('bg-grad-cta');
    // colorblind/token discipline: no raw hex ever lands in the rendered class list
    expect(btn.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('renders a leading icon aria-hidden (decorative)', () => {
    render(<Button leftIcon={<svg data-testid="ic" />}>Save</Button>);
    expect(screen.getByTestId('ic').parentElement).toHaveAttribute('aria-hidden', 'true');
  });
});
