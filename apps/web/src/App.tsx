import { hasRole, personaShell } from '@redex/auth';
import { AppShell, Button, NavPill, StatusBadge } from '@redex/ui';
import { useTranslation } from 'react-i18next';
import { LoginPage } from './auth/components/LoginPage';
import { RoleGate } from './auth/components/RoleGate';
import { signOut, useAuth } from './auth/useAuth';
import { Constellation } from './catalog/Constellation';
import { SyncStatus } from './components/SyncStatus';
import { Ac203SimScreen } from './forge/Ac203SimScreen';
import { SignoffScreen } from './features/signoff/SignoffScreen';
import { useAppRoute } from './navigation';

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
  const { route, navigate } = useAppRoute();

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

  // M3 — the AC-203 branching egress-fail sim is an auth-gated in-app screen,
  // entered from its Constellation boss node (?screen=sim&course=AC-203).
  const inSim = route.screen === 'sim' && route.course === 'AC-203';
  // M6 — the Evaluator field sign-off, an auth-gated in-app screen entered from the
  // evaluator section (?screen=signoff). Gated to the 'evaluator' role (RLS is the
  // real boundary; this only hides UI). The signoff itself authorizes server-side.
  const inSignoff = route.screen === 'signoff' && claims != null && hasRole(claims, 'evaluator');

  return (
    <AppShell
      density={density}
      proofPoints={0}
      onBackpack={() => {}}
      screenKey={inSim ? 'sim-ac203' : inSignoff ? 'signoff' : 'home'}
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
      {inSim ? (
        <Ac203SimScreen onExit={() => navigate({ screen: null, course: null })} />
      ) : inSignoff ? (
        <SignoffScreen onExit={() => navigate({ screen: null, course: null })} />
      ) : (
        <div className="flex flex-col gap-5 pb-10">
          <div className="px-8 pt-2">
            <SyncStatus />
          </div>

          {/* M1 — the prerequisite-gated skill-map home (the product's first screen). */}
          <Constellation />

          {/* M6 — the Evaluator "Prove one" field sign-off entry (role-gated). */}
          <RoleGate claims={claims} anyOf={['evaluator']}>
            <section aria-label="Evaluator tools" className="flex items-center gap-3 px-8">
              <span className="text-body text-ink-muted">{t('signoff.entry_label')}</span>
              <Button
                variant="primary"
                size="sm"
                data-testid="open-signoff"
                onClick={() => navigate({ screen: 'signoff', course: null })}
              >
                {t('signoff.entry_cta')}
              </Button>
            </section>
          </RoleGate>

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
      )}
    </AppShell>
  );
}
