import { flush as defaultFlush } from './sync-queue';

export interface SyncManagerConfig {
  syncUrl: string;
  /** Returns the current access token (from the auth session). May be undefined
   *  pre-auth; the server will 401 and the queue stays put (no work lost). */
  getToken?: () => string | undefined;
  retryBaseMs?: number;
  /** Injectable for tests. */
  flushImpl?: typeof defaultFlush;
}

export interface SyncManager {
  flushNow: () => Promise<void>;
  stop: () => void;
}

/**
 * Wire the offline queue to reconnect (F4 Task 5): flush on the `online` event,
 * flush once at startup if already online, and retry with exponential backoff on
 * failure. Queued work therefore actually leaves the device when the network
 * returns — without this, the queue would persist but never sync.
 */
export function startSync(config: SyncManagerConfig): SyncManager {
  const flushImpl = config.flushImpl ?? defaultFlush;
  const retryBase = config.retryBaseMs ?? 5000;
  let attempt = 0;
  let timer: number | undefined;

  const schedule = () => {
    if (typeof window === 'undefined') return;
    const delay = Math.min(retryBase * 2 ** Math.min(attempt, 5), 5 * 60_000);
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void flushNow(), delay);
  };

  const flushNow = async () => {
    try {
      await flushImpl(config.syncUrl, { token: config.getToken?.() });
      attempt = 0; // success → reset backoff
    } catch {
      attempt += 1; // failure → retry with backoff (no work lost)
      schedule();
    }
  };

  const onOnline = () => void flushNow();
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
    if (typeof navigator !== 'undefined' && navigator.onLine) void flushNow();
  }

  return {
    flushNow,
    stop() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
        window.clearTimeout(timer);
      }
    },
  };
}
