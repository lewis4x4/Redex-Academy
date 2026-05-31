import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted so the mock factory (which is hoisted) can reference `auth`.
const { auth } = vi.hoisted(() => ({
  auth: {
    signInWithOtp: vi.fn(),
    verifyOtp: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  },
}));
vi.mock('./supabaseClient', () => ({ supabase: { auth } }));

import { sendMagicLink, signInWithGoogle, signInWithPassword, verifyEmailCode } from './authClient';

const ok = { data: {}, error: null };
const err = (message: string, status?: number) => ({ data: {}, error: { message, status } });

beforeEach(() => {
  for (const fn of Object.values(auth)) fn.mockReset();
});

describe('F3b auth client wrappers', () => {
  it('sendMagicLink uses OTP with shouldCreateUser + the /auth/callback redirect', async () => {
    auth.signInWithOtp.mockResolvedValue(ok);
    const r = await sendMagicLink('tech@goredex.com');
    expect(r).toEqual({ ok: true });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'tech@goredex.com',
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  });

  it('verifyEmailCode verifies the email OTP (token trimmed) and reports success', async () => {
    auth.verifyOtp.mockResolvedValue(ok);
    const r = await verifyEmailCode('tech@goredex.com', ' 123456 ');
    expect(r).toEqual({ ok: true });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'tech@goredex.com',
      token: '123456',
      type: 'email',
    });
  });

  it('signInWithGoogle starts OAuth with the callback redirect', async () => {
    auth.signInWithOAuth.mockResolvedValue(ok);
    expect(await signInWithGoogle()).toEqual({ ok: true });
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  });

  it('maps a rate-limit error to a friendly message (never raw provider text)', async () => {
    auth.signInWithOtp.mockResolvedValue(err('Email rate limit exceeded', 429));
    const r = await sendMagicLink('a@b.co');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/too many/i);
  });

  it('maps an expired code to a friendly message', async () => {
    auth.verifyOtp.mockResolvedValue(err('Token has expired or is invalid'));
    const r = await verifyEmailCode('a@b.co', '000000');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/expired/i);
  });

  it('maps bad password credentials without leaking which field was wrong', async () => {
    auth.signInWithPassword.mockResolvedValue(err('Invalid login credentials'));
    const r = await signInWithPassword('a@b.co', 'nope');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/email or password is incorrect/i);
  });
});
