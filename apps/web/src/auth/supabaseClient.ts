import { createClient } from '@supabase/supabase-js';

// Client-public values only (VITE_*). The anon key is publishable; never put a
// service-role key or any server secret in the browser bundle (CLAUDE.md inv. 8).
// Fallbacks let the client construct in dev/test without env; getSession then
// returns null (no network) until a real session exists.
const url = import.meta.env.VITE_SUPABASE_URL ?? 'http://localhost:54321';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'anon-placeholder';

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
