import { type AcademyClaims, decodeJwtClaims } from '@redex/auth';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export interface AdminAuthState {
  session: Session | null;
  claims: AcademyClaims | null;
  loading: boolean;
}

/** Admin session + decoded F3 claims. Authoring roles (author/curriculum_admin/
 *  org_admin) gate the admin surfaces; full authoring UI is M9. */
export function useAuth(): AdminAuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  const claims = session?.access_token ? decodeJwtClaims(session.access_token) : null;
  return { session, claims, loading };
}

export function signInWithSSO(provider: 'google' | 'azure') {
  return supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: import.meta.env.VITE_APP_BASE_URL ?? window.location.origin },
  });
}

export function signOut() {
  return supabase.auth.signOut();
}
