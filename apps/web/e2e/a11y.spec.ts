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
  // Scan with reduced motion emulated: the @redex/ui keyframe guard then disables
  // every rdx-anim-* entrance + the Skeleton shimmer, so the DOM is static and at
  // its final, fully-opaque paint. Otherwise axe can sample contrast mid-fadeUp
  // (opacity < 1) and report false low-contrast on text that is AA at rest. This is
  // also the correct a11y posture — the page must be clean under reduced motion.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/dev/ui');
  await page.getByRole('radiogroup', { name: /Persona density/i }).waitFor();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});

// M1: the signed-in Constellation home (the product's first screen) must pass axe
// — labelled skill-map nodes, colorblind-safe states (shape+glyph+text), AA
// contrast on the dark canvas. Seeded session + a deterministic fixture graph so
// the screen renders without a live backend (no global beforeEach — the login
// test above must stay logged OUT).
test('the M1 Constellation home has no axe violations (WCAG 2a/2aa)', async ({ page }) => {
  await page.addInitScript(() => {
    const b64url = (o: unknown) =>
      btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const claims = {
      sub: '00000000-0000-0000-0000-0000000000c3',
      org_id: '00000000-0000-0000-0000-0000000000a1',
      roles: ['learner'],
      persona: 'priya',
    };
    const token = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(claims)}.sig`;
    window.localStorage.setItem(
      'sb-localhost-auth-token',
      JSON.stringify({
        access_token: token,
        refresh_token: 'fake',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: 4102444800,
        user: {
          id: claims.sub,
          aud: 'authenticated',
          role: 'authenticated',
          email: 't@e.co',
          app_metadata: {},
          user_metadata: {},
          created_at: '2026-01-01T00:00:00.000Z',
        },
      }),
    );
  });
  const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  };
  const courses = [
    {
      id: 'r1',
      code: 'FND-101',
      title: 'Welcome',
      domain: 'FND',
      tier: 'foundations',
      personas: ['priya'],
      active_version_id: 'v1',
      status: 'published',
    },
    {
      id: 'r2',
      code: 'AC-201',
      title: 'Single-Door',
      domain: 'AC',
      tier: 'core',
      personas: ['priya'],
      active_version_id: 'v2',
      status: 'published',
    },
    {
      id: 'g',
      code: 'AC-203',
      title: 'Egress',
      domain: 'AC',
      tier: 'core',
      personas: ['priya'],
      active_version_id: 'v3',
      status: 'published',
    },
  ];
  const prereqs = [
    { course_id: 'g', requires_course_id: 'r1', kind: 'hard_gate' },
    { course_id: 'g', requires_course_id: 'r2', kind: 'hard_gate' },
  ];
  await page.route('**/rest/v1/**', (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: CORS, body: '' });
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith('/courses')
      ? courses
      : path.endsWith('/course_prerequisites')
        ? prereqs
        : [];
    return route.fulfill({
      status: 200,
      headers: { ...CORS, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('[data-course="AC-203"]').waitFor(); // constellation rendered
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});
