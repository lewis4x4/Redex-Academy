import { expect, test } from '@playwright/test';

// D1 e2e: the design system renders in a real browser — the gallery shows the kit,
// persona density toggles (PURE LAYOUT, never permissions), and the F3 login is
// re-skinned on the dark/red brand. (The full visual match vs the prototype is the
// [HUMAN-VERIFY] gate; this proves the wiring + the density mechanism.)

test('the component gallery renders the kit at /dev/ui', async ({ page }) => {
  await page.goto('/dev/ui');
  await expect(page.getByRole('radiogroup', { name: /Persona density/i })).toBeVisible();
  // a brand element + at least one primitive specimen rendered
  await expect(page.getByText('ACADEMY', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Field density/i })).toBeVisible();
});

test('persona density toggles between field and dense (layout only)', async ({ page }) => {
  await page.goto('/dev/ui');
  const root = page.locator('[data-density]').first();
  await expect(root).toHaveAttribute('data-density', 'dense'); // default
  await page.getByRole('button', { name: /Field density/i }).click();
  await expect(root).toHaveAttribute('data-density', 'field');
  await page.getByRole('button', { name: /Dense density/i }).click();
  await expect(root).toHaveAttribute('data-density', 'dense');
});

test('the F3 login is re-skinned on the dark/red brand (navy screen is gone)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Redex Academy');
  // The BrandMark wordmark + the SSO CTAs render on the new kit.
  await expect(page.getByText('ACADEMY', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Google Workspace/i })).toBeVisible();
  // Dark canvas: the body resolves to the near-black canvas token (not white).
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).not.toBe('rgb(255, 255, 255)');
});
