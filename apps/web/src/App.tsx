import { personaShell } from '@redex/auth';
import { StatusBadge } from '@redex/ui';
import { useTranslation } from 'react-i18next';
import { LoginPage } from './auth/components/LoginPage';
import { RoleGate } from './auth/components/RoleGate';
import { signOut, useAuth } from './auth/useAuth';

/**
 * F3 auth-aware shell. Logged out → SSO login. Logged in → a persona-adaptive
 * shell (UI driven by the `persona` claim) with a role-gated supervisory section
 * (permissions driven by the `roles` claim) — the two are kept distinct
 * (CODING_STANDARDS §7). Real feature surfaces arrive in M1+.
 */
export default function App() {
  const { t } = useTranslation();
  const { session, claims, loading } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-slate-900">
        <p role="status">{t('app.loading')}</p>
      </main>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  const shell = personaShell(claims?.persona);
  const isField = shell === 'field';

  return (
    <main
      data-shell={shell}
      className={`min-h-screen bg-white text-slate-900 ${isField ? 'text-lg' : 'text-base'}`}
    >
      <div
        className={`mx-auto flex flex-col gap-6 px-6 py-12 ${isField ? 'max-w-md' : 'max-w-4xl'}`}
      >
        <header className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-redex">{t('app.title')}</h1>
            <p className="text-slate-600">{t('app.tagline')}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
          >
            Sign out
          </button>
        </header>

        <section aria-label="Session" className="text-sm text-slate-600">
          Signed in · shell: <span data-testid="shell">{shell}</span>
          {claims?.persona ? ` (persona: ${claims.persona})` : ''}
        </section>

        <RoleGate claims={claims} anyOf={['manager', 'org_admin', 'exec']}>
          <section aria-label="Manager tools" className="flex items-center gap-3">
            <span className="text-sm text-slate-500">Supervisory:</span>
            <StatusBadge kind="pending" label="Manager dashboard" />
          </section>
        </RoleGate>
      </div>
    </main>
  );
}
