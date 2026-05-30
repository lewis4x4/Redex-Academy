import { personaShell } from '@redex/auth';
import { AppShell, Button, NavPill, ScreenHead, StatusBadge } from '@redex/ui';
import { useTranslation } from 'react-i18next';
import { LoginPage } from './auth/components/LoginPage';
import { RoleGate } from './auth/components/RoleGate';
import { signOut, useAuth } from './auth/useAuth';
import { SyncStatus } from './components/SyncStatus';

/**
 * Auth-aware shell (F3) re-skinned on the D1 design system, carrying the F4
 * offline-sync indicator. Logged out → the dark/red SSO login. Logged in → the
 * @redex/ui AppShell with persona-adaptive DENSITY (Marco = field, large-touch;
 * Priya/Dana = dense) and a role-gated supervisory section (permissions from the
 * `roles` claim) — persona drives density, roles drive permissions, never
 * conflated. The SyncStatus banner makes queued-but-unsynced OR server-refused
 * work UNMISSABLE (INT-102): a tech can never mistake unfinished offline work for
 * a completed job. Renders entirely on tokens.
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
        <ScreenHead
          eyebrow="Signed in"
          title="Your"
          accent="Academy"
          subtitle="Real feature surfaces — the Constellation, lessons, sims, sign-off — arrive in M1+."
        />

        <div className="px-8">
          <SyncStatus />
        </div>

        <section aria-label="Session" className="px-8 text-body text-ink-muted">
          Shell density:{' '}
          <span data-testid="shell" className="font-label text-white">
            {density}
          </span>
          {claims?.persona ? ` · persona: ${claims.persona}` : ''}
        </section>

        <RoleGate claims={claims} anyOf={['manager', 'org_admin', 'exec']}>
          <section aria-label="Manager tools" className="flex items-center gap-3 px-8">
            <span className="text-body text-ink-muted">Supervisory:</span>
            <StatusBadge kind="pending" label="Manager dashboard" />
          </section>
        </RoleGate>
      </div>
    </AppShell>
  );
}
