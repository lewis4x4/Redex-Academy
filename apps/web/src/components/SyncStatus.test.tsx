import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SyncStatus } from './SyncStatus';

const h = vi.hoisted(() => ({ state: { online: true, pending: 0, rejected: 0 } }));
vi.mock('../offline/sync-state', () => ({
  useSyncState: () => ({ ...h.state, refresh: async () => {} }),
}));

const data = () => screen.getByLabelText('Sync status').getAttribute('data-sync');

describe('SyncStatus (unmissable — INT-102)', () => {
  it('online + nothing queued → synced', () => {
    h.state = { online: true, pending: 0, rejected: 0 };
    render(<SyncStatus />);
    expect(data()).toBe('synced');
  });

  it('offline with queued work → "will complete on reconnect" (never done)', () => {
    h.state = { online: false, pending: 2, rejected: 0 };
    render(<SyncStatus />);
    expect(data()).toBe('offline');
    expect(screen.getByLabelText('Sync status')).toHaveTextContent('will complete on reconnect');
  });

  it('a REFUSED item never shows synced — surfaces "NOT recorded"', () => {
    h.state = { online: true, pending: 0, rejected: 1 };
    render(<SyncStatus />);
    expect(data()).toBe('rejected');
    expect(data()).not.toBe('synced');
    expect(screen.getByLabelText('Sync status')).toHaveTextContent('NOT recorded');
  });
});
