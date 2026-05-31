import { BrandMark, Button, Card, Input, cx } from '@redex/ui';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  sendMagicLink,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  verifyEmailCode,
} from '../authClient';

type Mode = 'magic' | 'password';
type Phase = 'idle' | 'busy';

// A faint, deterministic starfield (decorative; twinkle is reduced-motion-gated by
// the @redex/ui keyframe guard). Positions are fixed so there is no layout shift.
const STARS = [
  [8, 18],
  [22, 64],
  [37, 12],
  [54, 40],
  [69, 76],
  [81, 24],
  [91, 58],
  [15, 88],
  [46, 92],
  [62, 8],
] as const;

/**
 * F3b — the flagship, magic-link-first login (the product's first impression).
 * Dark/red branded canvas (vignette + core-glow + starfield, all reduced-motion
 * safe), a glassmorphic card, and the auth priority order: magic link + 6-digit
 * code (primary) → password (fallback) → Google Workspace SSO (tertiary). No
 * credentials or permissions are decided here — the F3 hook mints claims server-
 * side and RLS enforces them. Built on @redex/ui tokens only (no raw hex, Inv 9).
 */
export function LoginPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('magic');
  const [phase, setPhase] = useState<Phase>('idle');
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const busy = phase === 'busy';
  const run = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError('');
    setPhase('busy');
    const r = await fn();
    setPhase('idle');
    if (!r.ok) setError(r.error);
    return r.ok;
  };

  const onSendLink = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => sendMagicLink(email))) setSent(true);
  };
  const onVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    await run(() => verifyEmailCode(email, code)); // success → SIGNED_IN → App swaps to the shell
  };
  const onPassword = async (e: FormEvent) => {
    e.preventDefault();
    await run(() => signInWithPassword(email, password));
  };

  return (
    <main className="rdx-scope rdx-canvas-vignette relative grid min-h-screen place-items-center overflow-hidden bg-canvas px-4 py-12 text-white">
      <div className="rdx-starfield" aria-hidden="true">
        {STARS.map(([left, top], i) => (
          <span
            key={i}
            className="star rdx-anim-twinkle"
            style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${i * 0.4}s` }}
          />
        ))}
      </div>
      <div
        className="rdx-core-glow pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2"
        aria-hidden="true"
      />

      <Card
        variant="glass"
        padding="lg"
        className="relative z-[1] w-full max-w-sm focus-within:shadow-glow"
      >
        <div className="flex flex-col gap-7">
          <header className="flex flex-col items-start gap-4">
            <BrandMark />
            <div>
              <h1 className="text-h1 font-bold tracking-tighttitle">{t('app.title')}</h1>
              <p className="mt-1 text-body-lg text-ink-muted">{t('app.tagline')}</p>
            </div>
          </header>

          {error ? (
            <p role="alert" className="text-body text-state-fail">
              {error}
            </p>
          ) : null}

          {sent ? (
            // ── "Check your email" — accepts the 6-digit code inline (no app exit) ──
            <form
              onSubmit={onVerifyCode}
              className="flex flex-col gap-4"
              aria-label={t('login.verify_aria')}
            >
              <p className="rdx-anim-seal text-body text-ink-soft" role="status">
                {t('login.sent_generic')}
              </p>
              <Input
                label={t('login.code_label')}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                required
                autoFocus
              />
              <Button type="submit" variant="cta" disabled={busy || code.length < 6}>
                {busy ? t('login.verifying') : t('login.verify')}
              </Button>
              <div className="flex items-center justify-between text-caption">
                <button
                  type="button"
                  className="text-ink-muted underline-offset-2 hover:text-white hover:underline"
                  onClick={() => void run(() => sendMagicLink(email))}
                  disabled={busy}
                >
                  {t('login.resend')}
                </button>
                <button
                  type="button"
                  className="text-ink-muted underline-offset-2 hover:text-white hover:underline"
                  onClick={() => {
                    setSent(false);
                    setCode('');
                    setError('');
                  }}
                >
                  {t('login.use_other_email')}
                </button>
              </div>
            </form>
          ) : mode === 'magic' ? (
            // ── Primary: magic link ───────────────────────────────────────────
            <form
              onSubmit={onSendLink}
              className="flex flex-col gap-4"
              aria-label={t('login.magic_aria')}
            >
              <Input
                label={t('login.email_label')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@company.com"
                required
                autoFocus
              />
              <Button type="submit" variant="cta" disabled={busy || !email}>
                {busy ? t('login.sending') : t('login.send_link')}
              </Button>
            </form>
          ) : (
            // ── Secondary: password fallback ──────────────────────────────────
            <form
              onSubmit={onPassword}
              className="flex flex-col gap-4"
              aria-label={t('login.password_aria')}
            >
              <Input
                label={t('login.email_label')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <Input
                label={t('login.password_label')}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <Button type="submit" variant="cta" disabled={busy || !email || !password}>
                {busy ? t('login.signing_in') : t('login.sign_in')}
              </Button>
              <button
                type="button"
                className="text-caption text-ink-muted underline-offset-2 hover:text-white hover:underline"
                onClick={() => void run(() => signUpWithPassword(email, password))}
                disabled={busy || !email || !password}
              >
                {t('login.set_password')}
              </button>
            </form>
          )}

          {!sent ? (
            <div className="flex flex-col gap-3">
              <div
                className="flex items-center gap-3 text-caption text-ink-muted"
                aria-hidden="true"
              >
                <span className="h-px flex-1 bg-line" />
                {t('login.or')}
                <span className="h-px flex-1 bg-line" />
              </div>
              <Button variant="secondary" onClick={() => void signInWithGoogle()} disabled={busy}>
                {t('login.google')}
              </Button>
              <button
                type="button"
                className={cx(
                  'text-caption text-ink-muted underline-offset-2 hover:text-white hover:underline',
                )}
                onClick={() => {
                  setMode((m) => (m === 'magic' ? 'password' : 'magic'));
                  setError('');
                }}
              >
                {mode === 'magic' ? t('login.use_password') : t('login.use_magic')}
              </button>
            </div>
          ) : null}
        </div>
      </Card>
    </main>
  );
}
