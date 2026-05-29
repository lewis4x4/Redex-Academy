import { expect, test } from '@playwright/test';

test('PWA app shell loads and shows the academy title', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Redex Academy');
  // The shell is a PWA shell: the web app manifest is linked.
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
});
