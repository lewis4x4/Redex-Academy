import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('login screen has no axe violations (WCAG 2a/2aa) and is keyboard-navigable', async ({
  page,
}) => {
  // Reduced motion: scan the final opaque paint (the login twinkle + entrance fades
  // otherwise read as false low contrast mid-animation); also the correct posture.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByLabel(/work email/i).waitFor();

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);

  // Keyboard reachable: the email field autofocuses and tabbing moves through the
  // interactive controls (input → buttons), never trapping.
  const focusedTags: string[] = [];
  for (let i = 0; i < 4; i++) {
    focusedTags.push(await page.evaluate(() => document.activeElement?.tagName ?? ''));
    await page.keyboard.press('Tab');
  }
  expect(focusedTags.some((tag) => tag === 'INPUT' || tag === 'BUTTON')).toBe(true);
});
