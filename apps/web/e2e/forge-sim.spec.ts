import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// The Forge preview is a PUBLIC route (no auth) — the M9 authoring sandbox path.
// These run the two reference sims end-to-end in a real browser (F5 DRY_RUN §4):
// score, emit (queued offline via F4), render rich + 2D fallback with parity, and
// pass axe with no color-only state.

test('engine #1 branching: the wrong fail-locked choice → safety-veto terminal (rich)', async ({
  page,
}) => {
  await page.goto('/forge-preview?sim=branching&mode=rich');
  await page.locator('[data-choice="begin"]').click();
  await page.locator('[data-choice="faillocked"]').click();
  const badge = page.getByRole('status');
  await expect(badge).toHaveAttribute('data-token', 'safety_veto');
  await expect(badge).toHaveAttribute('data-shape', 'octagon'); // shape, not color alone
  await expect(page.getByTestId('veto-feedback')).toBeVisible();
  await expect(page.getByTestId('postmortem-replay')).toBeVisible();
});

test('2D fallback is first-class: same safety-veto token as rich for the same input', async ({
  page,
}) => {
  await page.goto('/forge-preview?sim=branching&mode=fallback2d');
  await expect(page.locator('[data-render-mode="fallback2d"]')).toBeVisible();
  await page.locator('[data-choice="begin"]').click();
  await page.locator('[data-choice="faillocked"]').click();
  await expect(page.getByRole('status')).toHaveAttribute('data-token', 'safety_veto');
});

test('engine #2 device-config: a fail-locked egress lock submits to a safety veto', async ({
  page,
}) => {
  await page.goto('/forge-preview?sim=device-config&mode=rich');
  await page.selectOption('[data-field="lock_output_mode"]', 'fail_locked');
  await page.getByTestId('submit').click();
  const badge = page.getByTestId('verdict').getByRole('status');
  await expect(badge).toHaveAttribute('data-token', 'safety_veto');
  await expect(page.getByTestId('veto-feedback')).toBeVisible();
});

test('a reference sim passes axe (WCAG 2a/2aa) and is keyboard reachable', async ({ page }) => {
  await page.goto('/forge-preview?sim=branching&mode=rich');
  await page.locator('[data-choice="begin"]').waitFor();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
  // tabbing reaches a choice button
  await page.keyboard.press('Tab');
  const tag = await page.evaluate(() => document.activeElement?.tagName);
  expect(tag).toBe('BUTTON');
});
