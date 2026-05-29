import { createClient } from '@supabase/supabase-js';

// Client-public values only (VITE_*); never a server secret in the bundle.
// (The web app has the same minimal client; when both apps need richer shared
// auth wiring, extract a @redex/auth-react package — tracked for M9.)
const url = import.meta.env.VITE_SUPABASE_URL ?? 'http://localhost:54321';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'anon-placeholder';

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
