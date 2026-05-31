import { expect, test } from '@playwright/test';

test('logged out: the magic-link-first login renders (email primary, Google tertiary)', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Redex Academy');
  await expect(page.getByLabel(/work email/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /send me a magic link/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Google Workspace/i })).toBeVisible();
});

// The full OIDC flow — log in via the IdP, the hook mints org_id/roles/persona,
// own-org rows visible, cross-org read = 0, a role change updates access — needs a
// LIVE Supabase Auth + IdP + the registered custom_access_token_hook with REAL
// minted tokens. That is the F3 [HUMAN-VERIFY] gate; it cannot run in CI without
// a live project + IdP, so it is skipped here (verified by a human on live).
test.skip('OIDC login → own-org rows / cross-org zero / role-change [HUMAN-VERIFY: live]', async () => {
  // Steps for the live human run:
  //  1. Sign in as the Redex dev evaluator (SSO) → decode the JWT → assert
  //     org_id/roles[]/persona/evaluator_authorized/domains are present + correct.
  //  2. Read a personal table → own-org rows appear (academy.current_org_id() live).
  //  3. Sign in as the CCS dev tech → the same read returns ZERO Redex rows.
  //  4. Grant `manager` to the CCS tech, re-mint → supervisory org rows now appear.
});
