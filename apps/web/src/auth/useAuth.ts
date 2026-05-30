import { type AcademyClaims, decodeJwtClaims } from '@redex/auth';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export interface AuthState {
  session: Session | null;
  /** Custom claims decoded from the access token (read-only; the server verifies). */
  claims: AcademyClaims | null;
  loading: boolean;
}

/** Subscribe to the Supabase session and expose the F3 custom claims. */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const claims = session?.access_token ? decodeJwtClaims(session.access_token) : null;
  return { session, claims, loading };
}

export type SsoProvider = 'google' | 'azure';

/** Start an OIDC SSO sign-in (Google Workspace / Microsoft Entra). */
export function signInWithSSO(provider: SsoProvider) {
  return supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: import.meta.env.VITE_APP_BASE_URL ?? window.location.origin },
  });
}

export function signOut() {
  return supabase.auth.signOut();
}
