import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Vacuous on the F1 shell, but the gate is wired now: every new screen must pass
// axe (WCAG 2.1 AA) and the colorblind-safe assertion (no color-only state).
test('app shell has no detectable axe violations (WCAG 2a/2aa)', async ({ page }) => {
  await page.goto('/');
  // The shell resolves the session async (then renders the login screen when
  // logged out) — wait for stable content before scanning.
  await page.getByRole('heading', { level: 1 }).waitFor();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});
