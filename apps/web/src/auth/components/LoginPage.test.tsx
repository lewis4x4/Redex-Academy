import { initI18n } from '@redex/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the supabase client so the real authClient (and the real EMAIL_OTP_LENGTH)
// run, but no network is touched. Mirrors authClient.test.ts.
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
vi.mock('../supabaseClient', () => ({ supabase: { auth } }));

import { EMAIL_OTP_LENGTH } from '../authClient';
import { LoginPage } from './LoginPage';

beforeEach(() => {
  for (const fn of Object.values(auth)) fn.mockReset();
  auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
  auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
  initI18n();
});

// Send the magic link, then return the revealed OTP code input.
async function reachCodeEntry(): Promise<HTMLInputElement> {
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText(/work email/i), {
    target: { value: 'tech@redex.education' },
  });
  fireEvent.click(screen.getByRole('button', { name: /magic link/i }));
  return (await screen.findByLabelText(
    new RegExp(`${EMAIL_OTP_LENGTH}-digit`, 'i'),
  )) as HTMLInputElement;
}

describe('LoginPage — OTP code input follows the configured length', () => {
  it('caps the input at EMAIL_OTP_LENGTH so it can never be shorter than the code', async () => {
    const input = await reachCodeEntry();
    expect(input).toHaveAttribute('maxlength', String(EMAIL_OTP_LENGTH));
    expect(input).toHaveAttribute('placeholder', '0'.repeat(EMAIL_OTP_LENGTH));
  });

  it('enables Verify only at full length, then verifies the full code', async () => {
    const input = await reachCodeEntry();
    const verify = screen.getByRole('button', { name: /verify/i });
    fireEvent.change(input, { target: { value: '1'.repeat(EMAIL_OTP_LENGTH - 1) } });
    expect(verify).toBeDisabled();
    const full = '1'.repeat(EMAIL_OTP_LENGTH);
    fireEvent.change(input, { target: { value: full } });
    expect(verify).toBeEnabled();
    fireEvent.click(verify);
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'tech@redex.education',
      token: full,
      type: 'email',
    });
  });

  it('is paste-safe: strips non-digits and excess length', async () => {
    const input = await reachCodeEntry();
    // A 6-length config turns "12 34-56789" into "123456"; any length stays capped.
    fireEvent.change(input, { target: { value: '12 34-56789' } });
    expect(input.value).toBe('123456789'.slice(0, EMAIL_OTP_LENGTH));
    expect(input.value.length).toBe(EMAIL_OTP_LENGTH);
  });
});
