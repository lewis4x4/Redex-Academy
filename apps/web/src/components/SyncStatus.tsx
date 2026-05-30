import { StatusBadge } from '@redex/ui';
import { useSyncState } from '../offline/sync-state';

/**
 * UNMISSABLE sync state (INT-102). Priority: REFUSED work (server rejected it —
 * NOT recorded) > queued/offline ("will complete on reconnect") > all-synced.
 * A refused or un-synced job never renders as done. Colorblind-safe via
 * StatusBadge (shape + text + color). Never fakes a pass.
 */
export function SyncStatus() {
  const { online, pending, rejected } = useSyncState();

  // Refused work is the loudest state — it was NOT recorded on the server.
  if (rejected > 0) {
    return (
      <div
        aria-live="assertive"
        aria-label="Sync status"
        data-sync="rejected"
        data-rejected={rejected}
        className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-state-fail"
      >
        <StatusBadge kind="fail" label="Not recorded" />
        <span>
          {rejected} item{rejected === 1 ? '' : 's'} were refused by the server and were NOT
          recorded — needs attention.
        </span>
      </div>
    );
  }

  if (online && pending === 0) {
    return (
      <div
        aria-live="polite"
        aria-label="Sync status"
        data-sync="synced"
        className="flex items-center gap-2 text-sm text-slate-600"
      >
        <StatusBadge kind="pass" label="All work synced" />
      </div>
    );
  }

  return (
    <div
      aria-live="polite"
      aria-label="Sync status"
      data-sync={online ? 'pending' : 'offline'}
      data-pending={pending}
      className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <StatusBadge kind="pending" label={online ? 'Syncing…' : 'Offline'} />
      <span>
        {pending} item{pending === 1 ? '' : 's'} will complete on reconnect — not yet recorded on
        the server.
      </span>
    </div>
  );
}
