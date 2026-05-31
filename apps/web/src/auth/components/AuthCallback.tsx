import { Card, ErrorState } from '@redex/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabaseClient';

/**
 * F3b — the magic-link / OAuth callback target (`/auth/callback`). supabase-js
 * (flowType:'pkce' + detectSessionInUrl) completes the code/token exchange on
 * load; we show a brief "Signing you in…", then route to the app shell on success
 * or a typed error state (expired/used link, denied) on failure. Without this
 * route the magic link dead-ends — it is required.
 */
export function AuthCallback() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'verifying' | 'error'>('verifying');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    let active = true;
    const goApp = () => {
      if (active) window.location.replace('/');
    };
    const fail = (msg: string) => {
      if (!active) return;
      setDetail(msg);
      setStatus('error');
    };

    // Explicit provider error in the link (expired/used/denied) — surfaced by GoTrue
    // in the hash or query.
    const params = new URLSearchParams(
      window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.search,
    );
    const urlErr = params.get('error_description') ?? params.get('error');
    if (urlErr) {
      fail(urlErr);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) goApp();
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) goApp();
    });
    // Safety net: if no session materializes, don't spin forever.
    const timer = window.setTimeout(() => fail(t('login.callback_timeout')), 8000);

    return () => {
      active = false;
      data.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, [t]);

  return (
    <main className="rdx-scope rdx-canvas-vignette grid min-h-screen place-items-center bg-canvas px-4 text-white">
      <Card variant="glass" padding="lg" className="w-full max-w-sm">
        {status === 'verifying' ? (
          <p role="status" aria-live="polite" className="text-body text-ink-soft">
            {t('login.signing_in_callback')}
          </p>
        ) : (
          <ErrorState
            title={t('login.callback_error_title')}
            description={detail || t('login.callback_error_desc')}
            action={
              <a
                href="/"
                className="text-body font-label text-redex-bright underline-offset-2 hover:underline"
              >
                {t('login.back_to_login')}
              </a>
            }
          />
        )}
      </Card>
    </main>
  );
}
