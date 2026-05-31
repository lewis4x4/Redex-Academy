// F3b auth client — typed wrappers around supabase-js auth, magic-link-first.
//
// Anon key only (Inv 8 — never the service-role key client-side). These wrappers
// never decide permissions; the F3 access-token hook mints org_id/roles/persona
// from the server on every token, and RLS enforces them. We only start auth flows
// and map errors to friendly, non-enumerating messages.

import type { AuthError } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

export type AuthResult = { ok: true } | { ok: false; error: string };

/**
 * The email OTP length — the SINGLE source the login code input derives from, so
 * the box count can never drift below the emailed code again (the bug: prod sent
 * an 8-digit code but the input was hard-capped at 6, so the code path could not
 * succeed). This MUST stay in lockstep with the server in THREE places:
 *   1. `supabase/config.toml` → [auth.email] otp_length            (local dev)
 *   2. the prod project's Auth → Email OTP Length (`mailer_otp_length`)
 *   3. this constant (drives the input's maxLength + validation + placeholder).
 * `otp-length.test.ts` parses (1) and fails CI if it diverges from this constant.
 */
export const EMAIL_OTP_LENGTH = 6;

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

/** Primary: send a magic link + email OTP code ({@link EMAIL_OTP_LENGTH} digits).
 *  The same OTP works as a clickable link (→ /auth/callback) OR an inline code
 *  (verifyEmailCode). First-time email = first login (shouldCreateUser unifies
 *  sign-up + log-in). */
export async function sendMagicLink(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: callbackUrl() },
  });
  return error ? { ok: false, error: friendly(error) } : { ok: true };
}

/** Verify the email OTP inline (no need to leave the app); whitespace-trimmed. */
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
