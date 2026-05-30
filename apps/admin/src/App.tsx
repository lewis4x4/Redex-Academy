import { hasRole } from '@redex/auth';
import { signInWithSSO, signOut, useAuth } from './auth/useAuth';

/**
 * F3 auth-aware authoring-admin shell. Logged out → SSO login. Logged in →
 * gated to authoring/supervisory roles (author/curriculum_admin/org_admin/exec).
 * Content-as-data authoring (sim specs, lessons, rubric line-items) is M9.
 */
export default function App() {
  const { session, claims, loading } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
        <p role="status">Loading…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
        <div className="flex w-full max-w-sm flex-col gap-4 px-6 py-16">
          <h1 className="text-2xl font-bold text-redex">Redex Academy — Authoring</h1>
          <button
            type="button"
            onClick={() => void signInWithSSO('google')}
            className="rounded-md bg-redex px-4 py-3 font-semibold text-white"
          >
            Sign in with Google Workspace
          </button>
          <button
            type="button"
            onClick={() => void signInWithSSO('azure')}
            className="rounded-md bg-redex px-4 py-3 font-semibold text-white"
          >
            Sign in with Microsoft Entra
          </button>
        </div>
      </main>
    );
  }

  const canAuthor = hasRole(
    claims ?? { roles: [] },
    'author',
    'curriculum_admin',
    'org_admin',
    'exec',
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 px-6 py-16">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-redex">Redex Academy — Authoring</h1>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            Sign out
          </button>
        </header>
        {canAuthor ? (
          <p className="text-slate-600">
            Authoring admin shell (F3 auth). Content-as-data authoring arrives in M9.
          </p>
        ) : (
          <p role="alert" className="text-state-fail">
            Your roles do not include authoring access.
          </p>
        )}
      </div>
    </main>
  );
}
