import { BrandMark, Button } from '@redex/ui';
import { useTranslation } from 'react-i18next';
import { type SsoProvider, signInWithSSO } from '../useAuth';

const PROVIDERS: { id: SsoProvider; label: string }[] = [
  { id: 'google', label: 'Sign in with Google Workspace' },
  { id: 'azure', label: 'Sign in with Microsoft Entra' },
];

/**
 * SSO login screen, re-skinned on the D1 design system (dark canvas + Redex red).
 * The OIDC redirect is handled by Supabase Auth + the configured provider; no
 * credentials are handled here. Persona/role come from the minted JWT claims after
 * sign-in (never from this screen). Renders entirely on @redex/ui tokens — no hex.
 */
export function LoginPage() {
  const { t } = useTranslation();
  return (
    <main className="rdx-scope rdx-canvas-vignette relative flex min-h-screen items-center justify-center bg-canvas text-white">
      <div className="relative z-[1] flex w-full max-w-sm flex-col gap-8 px-6 py-16">
        <header className="flex flex-col gap-5">
          <BrandMark />
          <div>
            <h1 className="text-h1 font-bold tracking-tighttitle">{t('app.title')}</h1>
            <p className="mt-1 text-body-lg text-ink-muted">{t('app.tagline')}</p>
          </div>
        </header>
        <section aria-label="Sign in" className="flex flex-col gap-3">
          {PROVIDERS.map((p) => (
            <Button key={p.id} variant="cta" onClick={() => void signInWithSSO(p.id)}>
              {p.label}
            </Button>
          ))}
        </section>
      </div>
    </main>
  );
}
