import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EMAIL_OTP_LENGTH } from './authClient';

// Anti-drift guard for the exact magic-link bug this fixes: the login code input's
// length MUST equal the email OTP length the server sends. `supabase/config.toml`
// is the declared source of truth (and the prod project's `mailer_otp_length` must
// match it — see EMAIL_OTP_LENGTH's doc). If anyone changes otp_length in
// config.toml without updating EMAIL_OTP_LENGTH (or vice-versa), CI fails here —
// so a 6-box input can never again be paired with an 8-digit emailed code.
const configToml = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../../supabase/config.toml'),
  'utf8',
);

describe('email OTP length is locked to supabase/config.toml', () => {
  it('[auth.email] otp_length === EMAIL_OTP_LENGTH', () => {
    // Line-anchored so it never matches a different *_otp_length key.
    const m = /^\s*otp_length\s*=\s*(\d+)/m.exec(configToml);
    expect(m, 'otp_length not found in supabase/config.toml').not.toBeNull();
    expect(Number(m![1])).toBe(EMAIL_OTP_LENGTH);
  });
});
