// ============================================================================
// features/backpack/BackpackScreen.tsx — the connected Digital Backpack screen.
// Loads the learner's own credentials (RLS-scoped) and renders the stack.
// Read-only: issuance/signing is server-only (issue-badge), never the client.
// ============================================================================
import { ErrorState, Skeleton } from '@redex/ui';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type BackpackCredential, groupIntoStack, loadBackpack } from './backpackSource';
import { BackpackView } from './BackpackView';

type LoadFn = (recipientUserId: string) => Promise<BackpackCredential[]>;

export interface BackpackScreenProps {
  recipientUserId: string;
  /** Injectable for tests; defaults to the real Supabase read. */
  load?: LoadFn;
  /** Injectable clock for deterministic expiry rendering. */
  nowIso?: string;
}

export function BackpackScreen({
  recipientUserId,
  load = loadBackpack,
  nowIso,
}: BackpackScreenProps): React.ReactElement {
  const { t } = useTranslation();
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'ready'; credentials: BackpackCredential[] }
  >({ kind: 'loading' });

  const refresh = useCallback(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    load(recipientUserId)
      .then((credentials) => {
        if (!cancelled) setState({ kind: 'ready', credentials });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ kind: 'error', message: (err as Error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [load, recipientUserId]);

  useEffect(() => refresh(), [refresh]);

  if (state.kind === 'loading') {
    return (
      <Skeleton
        aria-label={t('backpack.loading', 'Loading your badges') as string}
        style={{ height: 160 }}
      />
    );
  }
  if (state.kind === 'error') {
    return (
      <ErrorState
        title={t('backpack.error.title', 'Could not load your backpack') as string}
        description={state.message}
        onRetry={refresh}
        retryLabel={t('backpack.error.retry', 'Retry') as string}
      />
    );
  }
  return (
    <BackpackView
      grouped={groupIntoStack(state.credentials)}
      nowIso={nowIso ?? new Date().toISOString()}
    />
  );
}
