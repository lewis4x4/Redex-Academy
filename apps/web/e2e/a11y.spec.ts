import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Vacuous on the F1 shell, but the gate is wired now: every new screen must pass
// axe (WCAG 2.1 AA) and the colorblind-safe assertion (no color-only state).
test('app shell / login (re-skinned, dark+red) has no axe violations (WCAG 2a/2aa)', async ({
  page,
}) => {
  await page.goto('/');
  // The shell resolves the session async (then renders the login screen when
  // logged out) — wait for stable content before scanning.
  await page.getByRole('heading', { level: 1 }).waitFor();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});

// D1: the component gallery is the reviewable artifact — every primitive + state
// in the dark/red theme must pass axe (contrast AA on the dark canvas, labelled
// controls, no color-only state).
test('the @redex/ui component gallery has no axe violations (WCAG 2a/2aa)', async ({ page }) => {
  await page.goto('/dev/ui');
  await page.getByRole('radiogroup', { name: /Persona density/i }).waitFor();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});
