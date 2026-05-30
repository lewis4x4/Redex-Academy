import { personaShell } from '@redex/auth';
import { AppShell, Button, NavPill, StatusBadge } from '@redex/ui';
import { useTranslation } from 'react-i18next';
import { LoginPage } from './auth/components/LoginPage';
import { RoleGate } from './auth/components/RoleGate';
import { signOut, useAuth } from './auth/useAuth';
import { Constellation } from './catalog/Constellation';
import { SyncStatus } from './components/SyncStatus';

/**
 * Auth-aware shell (F3) re-skinned on the D1 design system, carrying the F4
 * offline-sync indicator and the M1 Constellation — the learner home. Logged out
 * → the dark/red SSO login. Logged in → the @redex/ui AppShell with
 * persona-adaptive DENSITY (Marco = field, large-touch; Priya/Dana = dense), the
 * prerequisite-gated skill-map (M1), and a role-gated supervisory section
 * (permissions from the `roles` claim) — persona drives density, roles drive
 * permissions, never conflated. SyncStatus keeps queued/refused offline work
 * UNMISSABLE (INT-102). Renders entirely on tokens.
 */
export default function App() {
  const { t } = useTranslation();
  const { session, claims, loading } = useAuth();

  if (loading) {
    return (
      <main className="rdx-scope flex min-h-screen items-center justify-center bg-canvas text-white">
        <p role="status" className="text-ink-muted">
          {t('app.loading')}
        </p>
      </main>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  // persona → shell DENSITY only (never permissions).
  const density = personaShell(claims?.persona);

  return (
    <AppShell
      density={density}
      proofPoints={0}
      onBackpack={() => {}}
      nav={
        <>
          <NavPill active>Home</NavPill>
          <NavPill>Catalog</NavPill>
        </>
      }
      actions={
        <Button variant="secondary" size="sm" onClick={() => void signOut()}>
          Sign out
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pb-10">
        <div className="px-8 pt-2">
          <SyncStatus />
        </div>

        {/* M1 — the prerequisite-gated skill-map home (the product's first screen). */}
        <Constellation />

        <RoleGate claims={claims} anyOf={['manager', 'org_admin', 'exec']}>
          <section aria-label="Manager tools" className="flex items-center gap-3 px-8">
            <span className="text-body text-ink-muted">{t('app.supervisory')}</span>
            <StatusBadge kind="pending" label={t('app.manager_dashboard')} />
          </section>
        </RoleGate>

        <section aria-label="Session" className="px-8 text-caption text-ink-dim">
          {t('app.shell_density')}:{' '}
          <span data-testid="shell" className="font-label text-ink-soft">
            {density}
          </span>
          {claims?.persona ? ` · ${claims.persona}` : ''}
        </section>
      </div>
    </AppShell>
  );
}
