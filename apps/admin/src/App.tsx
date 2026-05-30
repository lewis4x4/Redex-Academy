import { hasRole } from '@redex/auth';
import { AppShell, BrandMark, Button, ScreenHead } from '@redex/ui';
import { signInWithSSO, signOut, useAuth } from './auth/useAuth';

/**
 * F3 authoring-admin shell, re-skinned on the D1 design system. Logged out → the
 * dark/red SSO login. Logged in → the @redex/ui AppShell, gated to authoring/
 * supervisory roles (author/curriculum_admin/org_admin/exec). Content-as-data
 * authoring (sim specs, lessons, rubric line-items) is M9. Renders on tokens — no hex.
 */
export default function App() {
  const { session, claims, loading } = useAuth();

  if (loading) {
    return (
      <main className="rdx-scope flex min-h-screen items-center justify-center bg-canvas text-white">
        <p role="status" className="text-ink-muted">
          Loading…
        </p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="rdx-scope rdx-canvas-vignette relative flex min-h-screen items-center justify-center bg-canvas text-white">
        <div className="relative z-[1] flex w-full max-w-sm flex-col gap-6 px-6 py-16">
          <BrandMark />
          <h1 className="text-h1 font-bold tracking-tighttitle">
            Authoring <span className="text-redex">Studio</span>
          </h1>
          <div className="flex flex-col gap-3">
            <Button variant="cta" onClick={() => void signInWithSSO('google')}>
              Sign in with Google Workspace
            </Button>
            <Button variant="cta" onClick={() => void signInWithSSO('azure')}>
              Sign in with Microsoft Entra
            </Button>
          </div>
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
    <AppShell
      density="dense"
      actions={
        <Button variant="secondary" size="sm" onClick={() => void signOut()}>
          Sign out
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pb-10">
        <ScreenHead eyebrow="Authoring" title="Content" accent="Studio" />
        <div className="px-8">
          {canAuthor ? (
            <p className="text-body text-ink-muted">
              Authoring admin shell (F3 auth). Content-as-data authoring arrives in M9.
            </p>
          ) : (
            <p role="alert" className="text-state-fail">
              Your roles do not include authoring access.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
