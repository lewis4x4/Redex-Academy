import { useEffect, useState } from 'react';
import { pendingCount, rejectedCount } from './sync-queue';

export interface SyncState {
  online: boolean;
  pending: number;
  /** Events the server REFUSED — must be surfaced, never hidden (INT-102). */
  rejected: number;
}

/**
 * Reactive offline-sync state for the UI. Tracks connectivity, the count of
 * queued events awaiting reconciliation, AND the count of server-rejected events.
 * SyncStatus uses all three to make an un-synced OR refused job UNMISSABLE
 * (INT-102) — a tech must never mistake queued/refused work for a completed job.
 */
export function useSyncState(): SyncState & { refresh: () => Promise<void> } {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [pending, setPending] = useState<number>(0);
  const [rejected, setRejected] = useState<number>(0);

  const refresh = async () => {
    try {
      setPending(await pendingCount());
      setRejected(await rejectedCount());
    } catch {
      // IndexedDB unavailable (e.g. private mode) — leave counts as-is.
    }
  };

  useEffect(() => {
    void refresh();
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.clearInterval(timer);
    };
  }, []);

  return { online, pending, rejected, refresh };
}
