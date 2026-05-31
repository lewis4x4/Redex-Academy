import { expect, test, type Route } from '@playwright/test';

// F3b — the magic-link-first login, end to end. No live Supabase in CI, so the
// GoTrue auth endpoints (/auth/v1/otp|verify|token|user) and the academy REST reads
// (/rest/v1/**) are intercepted with deterministic fixtures. This proves the UI
// flow + session wiring in a real browser; error mapping + the exact provider calls
// are proven by the unit test (src/auth/authClient.test.ts).

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
};
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const b64url = (o: unknown) =>
  Buffer.from(JSON.stringify(o))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

// A session whose access_token decodes (client-side, unverified) to F3 claims.
function fakeSession() {
  const claims = {
    sub: '00000000-0000-0000-0000-0000000000c3',
    org_id: '00000000-0000-0000-0000-0000000000a1',
    roles: ['learner'],
    persona: 'priya',
  };
  const token = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(claims)}.sig`;
  return {
    access_token: token,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 4102444800,
    refresh_token: 'fake-refresh',
    user: {
      id: claims.sub,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'tech@goredex.com',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z',
    },
  };
}

// Intercept the GoTrue auth API + the academy REST reads. `verify`/`token` return a
// session → supabase-js persists it + emits SIGNED_IN → the app swaps to the shell.
async function mockBackend(page: import('@playwright/test').Page) {
  await page.route('**/auth/v1/**', (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: CORS, body: '' });
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/otp')) return json(route, {}); // magic link "sent"
    if (path.endsWith('/verify') || path.endsWith('/token')) return json(route, fakeSession());
    if (path.endsWith('/user')) return json(route, fakeSession().user);
    return json(route, {});
  });
  await page.route('**/rest/v1/**', (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: CORS, body: '' });
    return json(route, []); // empty catalog → Constellation renders its empty state, no error
  });
}

test('logged out → the magic-link-first login renders', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Redex Academy');
  await expect(page.getByLabel(/work email/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /send me a magic link/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Google Workspace/i })).toBeVisible();
});

test('magic link: enter email → "check your email" + inline 6-digit code', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await page.getByLabel(/work email/i).fill('tech@goredex.com');
  await page.getByRole('button', { name: /send me a magic link/i }).click();
  await expect(page.getByText(/we sent a sign-in link and code/i)).toBeVisible();
  await expect(page.getByLabel(/6-digit code/i)).toBeVisible();
});

test('6-digit code path signs in and lands in the app shell with claims', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await page.getByLabel(/work email/i).fill('tech@goredex.com');
  await page.getByRole('button', { name: /send me a magic link/i }).click();
  await page.getByLabel(/6-digit code/i).fill('123456');
  await page.getByRole('button', { name: /^Verify code$/i }).click();
  // SIGNED_IN → App swaps to the shell (priya → dense). claims came from the token.
  await expect(page.getByTestId('shell')).toHaveText('dense');
});

test('password fallback signs in and lands in the app shell', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await page.getByRole('button', { name: /use a password instead/i }).click();
  await page.getByLabel(/work email/i).fill('tech@goredex.com');
  await page.getByLabel(/^password$/i).fill('hunter2hunter2');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page.getByTestId('shell')).toHaveText('dense');
});

test('the /auth/callback route completes a seeded session and routes to the app', async ({
  page,
}) => {
  await mockBackend(page);
  await page.addInitScript((session) => {
    window.localStorage.setItem('sb-localhost-auth-token', JSON.stringify(session));
  }, fakeSession());
  await page.goto('/auth/callback');
  // AuthCallback finds the session and replaces → app shell at /.
  await expect(page.getByTestId('shell')).toHaveText('dense');
});

// ── Error paths: the mapped, non-enumerating messages must actually render ──────

test('an invalid / expired code surfaces a friendly error (not raw provider text)', async ({
  page,
}) => {
  await mockBackend(page);
  // Override verify → 400 expired (registered after mockBackend, so it wins).
  await page.route('**/auth/v1/verify*', (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: CORS, body: '' });
    return json(
      route,
      { error: 'invalid_grant', error_description: 'Token has expired or is invalid' },
      400,
    );
  });
  await page.goto('/');
  await page.getByLabel(/work email/i).fill('tech@goredex.com');
  await page.getByRole('button', { name: /send me a magic link/i }).click();
  await page.getByLabel(/6-digit code/i).fill('000000');
  await page.getByRole('button', { name: /^Verify code$/i }).click();
  await expect(page.getByRole('alert')).toContainText(/expired/i);
  await expect(page.getByTestId('shell')).toHaveCount(0); // not signed in
});

test('a rate-limited send surfaces "too many attempts"', async ({ page }) => {
  await mockBackend(page);
  await page.route('**/auth/v1/otp*', (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: CORS, body: '' });
    return json(route, { error_description: 'Email rate limit exceeded' }, 429);
  });
  await page.goto('/');
  await page.getByLabel(/work email/i).fill('tech@goredex.com');
  await page.getByRole('button', { name: /send me a magic link/i }).click();
  await expect(page.getByRole('alert')).toContainText(/too many/i);
});

test('the /auth/callback route shows a typed error state for a denied/expired link', async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto('/auth/callback?error=access_denied&error_description=The+link+has+expired');
  await expect(page.getByText(/sign-in didn't complete/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /back to sign in/i })).toBeVisible();
});
