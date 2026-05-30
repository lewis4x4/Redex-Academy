import { useTranslation } from 'react-i18next';
import { type SsoProvider, signInWithSSO } from '../useAuth';

const PROVIDERS: { id: SsoProvider; label: string }[] = [
  { id: 'google', label: 'Sign in with Google Workspace' },
  { id: 'azure', label: 'Sign in with Microsoft Entra' },
];

/**
 * SSO login screen. The actual OIDC redirect is handled by Supabase Auth + the
 * configured provider; no credentials are ever handled in the client. Persona/
 * role come from the minted JWT claims after sign-in (never from this screen).
 */
export function LoginPage() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-screen items-center justify-center bg-white text-slate-900">
      <div className="flex w-full max-w-sm flex-col gap-6 px-6 py-16">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-redex">{t('app.title')}</h1>
          <p className="text-lg text-slate-600">{t('app.tagline')}</p>
        </header>
        <section aria-label="Sign in" className="flex flex-col gap-3">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => void signInWithSSO(p.id)}
              className="rounded-md bg-redex px-4 py-3 text-base font-semibold text-white hover:opacity-90"
            >
              {p.label}
            </button>
          ))}
        </section>
      </div>
    </main>
  );
}
