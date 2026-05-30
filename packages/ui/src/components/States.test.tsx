import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState, ErrorState, Skeleton } from './States';

describe('Skeleton', () => {
  it('renders a decorative (aria-hidden) shimmer block with the surface token + sizing', () => {
    const { container } = render(<Skeleton width={120} height={16} data-testid="sk" />);
    const el = screen.getByTestId('sk');
    expect(el).toHaveAttribute('aria-hidden', 'true');
    // shimmer base = surface-2 fill + the token-only gradient sweep
    expect(el.className).toContain('bg-surface-2');
    expect(el.className).toContain('via-line');
    expect(el.style.width).toBe('120px');
    expect(el.style.height).toBe('16px');
    // the sweep is gated behind reduced motion
    expect(el.className).toContain('animate-pulse');
    expect(el.className).toContain('motion-reduce:animate-none');
    expect(el.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    // sanity: only one element rendered
    expect(container.firstElementChild).toBe(el);
  });

  it('applies the requested radius token and merges className + forwards ref', () => {
    const ref = createRef<HTMLDivElement>();
    render(<Skeleton ref={ref} rounded="pill" className="custom-x" data-testid="sk2" />);
    const el = screen.getByTestId('sk2');
    expect(ref.current).toBe(el);
    expect(el.className).toContain('rounded-pill');
    expect(el.className).toContain('custom-x');
  });
});

describe('EmptyState', () => {
  it('renders a polite status region with its title + description', () => {
    render(<EmptyState title="No courses yet" description="Published courses will appear here." />);
    const region = screen.getByRole('status');
    expect(region).toBeInTheDocument();
    expect(screen.getByText('No courses yet')).toBeInTheDocument();
    expect(screen.getByText('Published courses will appear here.')).toBeInTheDocument();
    expect(region.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('renders the optional icon (aria-hidden) and action slots', () => {
    render(
      <EmptyState
        icon={<svg data-testid="ic" />}
        title="Empty"
        action={<button>Add gear</button>}
      />,
    );
    expect(screen.getByTestId('ic').parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: 'Add gear' })).toBeInTheDocument();
  });

  it('omits the description and action when not provided', () => {
    render(<EmptyState title="Nothing here" data-testid="empty" />);
    const region = screen.getByTestId('empty');
    // only the title paragraph renders inside the region
    expect(region.querySelectorAll('p')).toHaveLength(1);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('ErrorState', () => {
  it('renders an assertive alert with a colorblind-safe warn glyph + default title', () => {
    render(<ErrorState />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    // status is not color-only: the ⚠ glyph carries meaning alongside the amber hue
    expect(alert.textContent).toContain('⚠');
    expect(alert.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('renders a keyboard-operable retry button wired to onRetry', () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Load failed" onRetry={onRetry} retryLabel="Try again" />);
    const btn = screen.getByRole('button', { name: 'Try again' });
    expect(btn).toHaveAttribute('type', 'button');
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(btn.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('renders a custom action instead of the default retry control', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} action={<button>Reload page</button>} />);
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    // the default retry control is suppressed when a custom action is supplied
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('renders no action control when neither onRetry nor action is given', () => {
    render(<ErrorState title="Offline" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('merges className + forwards ref', () => {
    const ref = createRef<HTMLDivElement>();
    render(<ErrorState ref={ref} className="custom-x" />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(screen.getByRole('alert').className).toContain('custom-x');
  });
});
