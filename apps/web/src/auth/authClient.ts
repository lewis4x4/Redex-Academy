// F3b auth client — typed wrappers around supabase-js auth, magic-link-first.
//
// Anon key only (Inv 8 — never the service-role key client-side). These wrappers
// never decide permissions; the F3 access-token hook mints org_id/roles/persona
// from the server on every token, and RLS enforces them. We only start auth flows
// and map errors to friendly, non-enumerating messages.

import type { AuthError } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

export type AuthResult = { ok: true } | { ok: false; error: string };

const callbackUrl = () => `${window.location.origin}/auth/callback`;

// Never reveal whether an email exists; never echo raw provider internals.
function friendly(error: AuthError | null): string {
  if (!error) return '';
  const msg = error.message?.toLowerCase() ?? '';
  if (msg.includes('rate') || error.status === 429)
    return 'Too many attempts — wait a moment and try again.';
  if (msg.includes('expired')) return 'That link or code has expired. Request a new one.';
  if (msg.includes('invalid') && msg.includes('token'))
    return "That code didn't match. Check your email and try again.";
  if (msg.includes('invalid login credentials')) return 'Email or password is incorrect.';
  return 'Something went wrong. Please try again.';
}

/** Primary: send a magic link + 6-digit code. The same OTP works as a clickable
 *  link (→ /auth/callback) OR an inline code (verifyEmailCode). First-time email
 *  = first login (shouldCreateUser unifies sign-up + log-in). */
export async function sendMagicLink(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: callbackUrl() },
  });
  return error ? { ok: false, error: friendly(error) } : { ok: true };
}

/** Verify the 6-digit email OTP inline (no need to leave the app). */
export async function verifyEmailCode(email: string, token: string): Promise<AuthResult> {
  const { error } = await supabase.auth.verifyOtp({ email, token: token.trim(), type: 'email' });
  return error ? { ok: false, error: friendly(error) } : { ok: true };
}

/** Secondary fallback: password sign-in (always available, zero email dependency). */
export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { ok: false, error: friendly(error) } : { ok: true };
}

/** Set-a-password path (dev: no email confirmation; prod flips to confirmations). */
export async function signUpWithPassword(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callbackUrl() },
  });
  return error ? { ok: false, error: friendly(error) } : { ok: true };
}

/** Tertiary: Google Workspace SSO (live completion is a release gate). */
export async function signInWithGoogle(): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callbackUrl() },
  });
  return error ? { ok: false, error: friendly(error) } : { ok: true };
}

export function signOut() {
  return supabase.auth.signOut();
}
