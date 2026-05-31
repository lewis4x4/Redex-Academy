import { initI18n } from '@redex/i18n';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdatePrompt } from './UpdatePrompt';

// Mock the SW layer: applyUpdate is a spy, no update pending at mount. The event
// name matches the real export so dispatching it drives the component.
const h = vi.hoisted(() => ({ applyUpdate: vi.fn() }));
vi.mock('./registerSW', () => ({
  SW_UPDATE_EVENT: 'redex:sw-update-available',
  applyUpdate: h.applyUpdate,
  isUpdatePending: () => false,
}));

const fireUpdateAvailable = () =>
  act(() => {
    window.dispatchEvent(new CustomEvent('redex:sw-update-available'));
  });

describe('UpdatePrompt — the "new version, reload" prompt', () => {
  beforeEach(() => {
    h.applyUpdate.mockClear();
    initI18n();
  });

  it('is hidden until a service-worker update is available', () => {
    render(<UpdatePrompt />);
    expect(screen.queryByTestId('sw-update-prompt')).toBeNull();
  });

  it('shows on the sw-update-available event; Reload applies the update', () => {
    render(<UpdatePrompt />);
    fireUpdateAvailable();
    expect(screen.getByTestId('sw-update-prompt')).toBeInTheDocument();
    expect(screen.getByText('A new version is available.')).toBeInTheDocument();
    // Reload is a real, keyboard-reachable button (colorblind-safe: text, not color).
    fireEvent.click(screen.getByTestId('sw-update-reload'));
    expect(h.applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('Dismiss hides the prompt without reloading', () => {
    render(<UpdatePrompt />);
    fireUpdateAvailable();
    fireEvent.click(screen.getByTestId('sw-update-dismiss'));
    expect(screen.queryByTestId('sw-update-prompt')).toBeNull();
    expect(h.applyUpdate).not.toHaveBeenCalled();
  });
});
