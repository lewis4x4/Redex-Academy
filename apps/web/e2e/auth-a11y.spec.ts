import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('login screen has no axe violations (WCAG 2a/2aa) and is keyboard-navigable', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Google Workspace/i }).waitFor();

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);

  // Keyboard reachable: tabbing focuses the SSO buttons.
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(focused).toBe('BUTTON');
});
