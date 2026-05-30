import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// PROXY ONLY (ledger §J): a Playwright setOffline run is necessary but NOT
// sufficient — the real gate is the airplane-mode run on actual hardware
// (docs/F4_HUMAN_VERIFICATION.md). This proves the UNMISSABLE offline-state UI
// flips in a real browser. The queue idempotency + double-flush-no-double-count
// is proven by the unit tests (offline/sync-queue.test.ts) and the SQL test
// (supabase/tests/sync_idempotency_test.sql).
//
// Reaching SyncStatus means getting past F3's auth gate. There is no live
// Supabase in CI (F3's own logged-in flow is a [HUMAN-VERIFY: live] gate), so we
// seed a session into the SAME storage key supabase-js reads for the dev-fallback
// URL (sb-localhost-auth-token) with a far-future expiry, so getSession() returns
// it WITHOUT a network call. The token is decoded client-side only
// (decodeJwtClaims never verifies) — so this drives the REAL logged-in shell +
// SyncStatus, not a stub. /sync is never called (VITE_SUPABASE_URL is unset → the
// sync manager is not started), so the proxy stays purely client-side.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const b64url = (o: unknown) =>
      btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const claims = {
      sub: '00000000-0000-0000-0000-0000000000c3',
      org_id: '00000000-0000-0000-0000-0000000000a1',
      roles: ['evaluator'],
      persona: 'marco',
    };
    const token = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(claims)}.sig`;
    const session = {
      access_token: token,
      refresh_token: 'fake-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 4102444800, // year 2100 → getSession returns it; no refresh/network
      user: {
        id: claims.sub,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'tech@example.com',
        app_metadata: {},
        user_metadata: {},
        created_at: '2026-01-01T00:00:00.000Z',
      },
    };
    window.localStorage.setItem('sb-localhost-auth-token', JSON.stringify(session));
  });
});

test('sync state is unmissable: synced → offline → synced (real browser, logged in)', async ({
  page,
  context,
}) => {
  await page.goto('/');
  // Past the auth gate → Marco's field shell (proves we exercise the real app).
  await expect(page.getByTestId('shell')).toHaveText('field');

  const status = page.getByLabel('Sync status');
  await expect(status).toBeVisible();
  await expect(status).toHaveAttribute('data-sync', 'synced'); // online, nothing queued

  // Go offline — the indicator must make it unmissable (INT-102).
  await context.setOffline(true);
  await expect(status).toHaveAttribute('data-sync', 'offline');
  await expect(status).toContainText('will complete on reconnect');

  // Back online — returns to synced (nothing was queued in this proxy run).
  await context.setOffline(false);
  await expect(status).toHaveAttribute('data-sync', 'synced');
});

test('logged-in shell with the sync indicator has no axe violations (WCAG 2a/2aa)', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Sync status').waitFor();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});

// The full download→act-offline→reconnect→reconcile path needs the served /sync
// Edge Function (Deno) + a DB; it is exercised at the [HUMAN-VERIFY] gate on real
// hardware. Documented + skipped here.
test.skip('download pack → act offline → reconnect → idempotent reconcile [HUMAN-VERIFY: real hardware]', async () => {});
