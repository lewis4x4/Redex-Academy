import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { Toast, ToastProvider, ToastStack, useToast } from './Toast';

describe('Toast', () => {
  it('renders the message text and a decorative (aria-hidden) leading icon', () => {
    render(<Toast>Saved</Toast>);
    // Message text is always present — meaning never rides on color alone.
    expect(screen.getByText('Saved')).toBeInTheDocument();
    // Default bolt icon slot is decorative.
    const svg = document.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('carries the pill + brand token classes and no raw hex', () => {
    const { container } = render(<Toast>Done</Toast>);
    const pill = container.firstElementChild as HTMLElement;
    expect(pill.className).toContain('rounded-pill');
    expect(pill.className).toContain('border-redex');
    expect(pill.className).toContain('bg-grad-panel');
    expect(pill.className).toContain('rdx-anim-toast-in');
    // token discipline: no raw hex ever lands in the rendered class list
    expect(pill.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('honors a custom icon slot, still aria-hidden', () => {
    render(<Toast icon={<svg data-testid="custom" />}>Hi</Toast>);
    expect(screen.getByTestId('custom').parentElement).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('ToastStack', () => {
  it('is a polite live region centered at the bottom, above modals', () => {
    render(<ToastStack>content</ToastStack>);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region.className).toContain('fixed');
    expect(region.className).toContain('bottom-6');
    expect(region.className).toContain('z-[130]');
    expect(region.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});

describe('useToast + ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ToastProvider defaultDurationMs={3000}>{children}</ToastProvider>
  );

  it('pushes a toast that appears in the live region then auto-dismisses', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.toast({ message: 'Promotion earned' });
    });
    expect(screen.getByText('Promotion earned')).toBeInTheDocument();
    expect(result.current.toasts).toHaveLength(1);

    // Auto-dismiss after the default duration (ref-based timer).
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText('Promotion earned')).not.toBeInTheDocument();
    expect(result.current.toasts).toHaveLength(0);
  });

  it('supports an explicit durationMs and early dismiss by id', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    let id = '';
    act(() => {
      id = result.current.toast({ message: 'Sticky-ish', durationMs: 10000 });
    });
    // Not yet gone at the default window since it set a longer duration.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('Sticky-ish')).toBeInTheDocument();

    act(() => {
      result.current.dismiss(id);
    });
    expect(screen.queryByText('Sticky-ish')).not.toBeInTheDocument();
  });

  it('treats durationMs <= 0 as sticky (never auto-dismisses)', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.toast({ message: 'Reconnect to finish', durationMs: 0 });
    });
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(screen.getByText('Reconnect to finish')).toBeInTheDocument();
  });

  it('throws if useToast is used outside a provider', () => {
    expect(() => renderHook(() => useToast())).toThrow(/ToastProvider/);
  });
});
