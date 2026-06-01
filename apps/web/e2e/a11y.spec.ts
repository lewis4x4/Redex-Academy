import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Vacuous on the F1 shell, but the gate is wired now: every new screen must pass
// axe (WCAG 2.1 AA) and the colorblind-safe assertion (no color-only state).
test('app shell / login (re-skinned, dark+red) has no axe violations (WCAG 2a/2aa)', async ({
  page,
}) => {
  // Reduced motion so axe samples the final, fully-opaque paint (the F3b login has a
  // starfield twinkle + entrance fades; mid-animation opacity reads as false low
  // contrast — see the gallery test below). This is also the correct a11y posture.
  await page.emulateMedia({ reducedMotion: 'reduce' });
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
  await page.goto('/?screen=constellation'); // the skill-map is its own sub-page now
  await page.locator('[data-course="AC-203"]').waitFor(); // constellation rendered
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});

// F3b: the magic-link callback route (the link target) must be accessible in its
// "signing you in…" state — a labelled live status on the dark canvas.
test('the /auth/callback route has no axe violations (WCAG 2a/2aa)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/auth/callback'); // no session → stays on the verifying state long enough to scan
  await page.getByText(/signing you in/i).waitFor();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});

// M3 / Phase 2: the AC-203 branching egress-fail sim — now reached INSIDE the
// course-player (the standalone ?screen=sim entry is retired) — must pass axe:
// labelled choice buttons, colorblind-safe state (shape+glyph+text), the SimStage
// rails, the per-unit course progress rail, the SVG tableau (role=img + alt), AA
// contrast. Seeded session + the course-player reads (the lesson is pre-'passed' so
// the player resumes on the scenario unit). Reduced motion so axe samples the final paint.
test('the AC-203 sim inside the course-player has no axe violations (WCAG 2a/2aa)', async ({
  page,
}) => {
  const GATE = '000000c1-0000-0000-0000-00000000000e';
  const CV = '000000c2-0000-0000-0000-00000000000e';
  const COMP = '000000c0-0000-0000-0000-00000000000f';
  const LESSON = '000000c3-000e-0000-0000-000000000001';
  const SCENARIO = '000000c3-000e-0000-0000-000000000002';
  const unitsFull = [
    {
      id: LESSON,
      ordinal: 1,
      kind: 'lesson',
      title: 'Lesson',
      competency_id: COMP,
      course_version_id: CV,
      content_ref: { mdx_key: 'ac-203/u1' },
      est_minutes: 50,
    },
    {
      id: SCENARIO,
      ordinal: 2,
      kind: 'scenario',
      title: 'Scenario',
      competency_id: COMP,
      course_version_id: CV,
      content_ref: { engine: 'branching_scenario', spec_key: 'ac-203/egress-compliant', gate: 0.9 },
      est_minutes: 45,
    },
  ];
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
  await page.route('**/rest/v1/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const p = url.searchParams;
    const body = (() => {
      if (path.endsWith('/courses'))
        return p.get('id')
          ? {
              id: GATE,
              code: 'AC-203',
              title: 'Egress',
              active_version_id: CV,
              status: 'published',
            }
          : [
              {
                id: GATE,
                code: 'AC-203',
                title: 'Egress',
                domain: 'AC',
                tier: 'core',
                personas: ['priya'],
                active_version_id: CV,
                status: 'published',
              },
            ];
      if (path.endsWith('/units'))
        return (p.get('select') ?? '').includes('content_ref')
          ? unitsFull
          : unitsFull.map((u) => ({
              id: u.id,
              ordinal: u.ordinal,
              kind: u.kind,
              competency_id: u.competency_id,
              course_version_id: u.course_version_id,
            }));
      if (path.endsWith('/enrollments'))
        return p.get('user_id')
          ? {
              id: 'enr1',
              status: 'in_progress',
              course_version_id: CV,
              started_at: '2026-01-01T00:00:00Z',
            }
          : [{ course_id: GATE, status: 'in_progress' }];
      if (path.endsWith('/unit_progress'))
        return [{ unit_id: LESSON, status: 'passed', score: 1, attempts: 1 }];
      return [];
    })();
    return route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/?screen=course-player&course=${GATE}`);
  await page.getByTestId('node-prompt').waitFor(); // the scenario unit mounted at its first decision
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});

// M6: the Evaluator field sign-off screen (the §5.4 rubric + 0–3 score controls +
// critical-safety marking) must pass axe — labelled radiogroups, fieldset/legend
// dimensions, colorblind-safe state (shape+text+colour), AA contrast on the dark
// canvas. Seeded EVALUATOR session + the rubric template intercept render it.
test('the M6 Evaluator sign-off screen has no axe violations (WCAG 2a/2aa)', async ({ page }) => {
  await page.addInitScript(() => {
    const b64url = (o: unknown) =>
      btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const claims = {
      sub: '00000000-0000-0000-0000-0000000000d4',
      org_id: '00000000-0000-0000-0000-0000000000a1',
      roles: ['evaluator'],
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
          email: 'e@e.co',
          app_metadata: {},
          user_metadata: {},
          created_at: '2026-01-01T00:00:00.000Z',
        },
      }),
    );
  });
  const tpl = [
    {
      line_item_key: 'ac203.release_on_power_loss',
      dimension: 'safety_compliance',
      is_critical_safety: true,
      ordinal: 1,
      label: 'releases on power loss',
    },
    {
      line_item_key: 'ac203.tech.fail_safe_wiring',
      dimension: 'technical_execution',
      is_critical_safety: false,
      ordinal: 2,
      label: 'fail-safe wiring',
    },
    {
      line_item_key: 'ac203.verify.three_release_modes_logged',
      dimension: 'verification_documentation',
      is_critical_safety: false,
      ordinal: 3,
      label: 'three modes logged',
    },
    {
      line_item_key: 'ac203.indep.recognize_no_maglock_escalate',
      dimension: 'independence_judgment',
      is_critical_safety: false,
      ordinal: 4,
      label: 'escalated',
    },
  ];
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: new URL(route.request().url()).pathname.endsWith('/signoff_line_item_templates')
        ? JSON.stringify(tpl)
        : '[]',
    }),
  );

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?screen=signoff');
  await page.getByTestId('candidate-input').waitFor(); // sign-off screen mounted
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});

// M2: an MDX lesson with its embedded 2D sim + retry-to-mastery knowledge check must
// pass axe — labelled radio inputs, the colorblind-safe Callout (glyph+word+color),
// the verdict StatusBadge (shape+text+color), AA contrast on the dark canvas. Seeded
// session + a units/assessment_items fixture render it without a backend.
test('the M2 lesson + knowledge check has no axe violations (WCAG 2a/2aa)', async ({ page }) => {
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
  const CV = '000000c2-0000-0000-0000-000000000009';
  const item = (id: string, safety: boolean) => ({
    id,
    kind: 'mcq',
    is_safety_item: safety,
    mastery_weight: 1,
    answer_key: { correct: 'a' },
    prompt: { text: `Question ${id}` },
    options: {
      choices: [
        { id: 'a', text: 'Correct' },
        { id: 'b', text: 'Wrong' },
      ],
    },
    locale_variants: {},
  });
  await page.route('**/rest/v1/**', (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: { 'access-control-allow-origin': '*' },
        body: '',
      });
    const url = new URL(route.request().url());
    const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    let body = '[]';
    if (url.pathname.endsWith('/assessment_items'))
      body = JSON.stringify([item('s1', true), item('n1', false)]);
    else if (url.pathname.endsWith('/units'))
      body = url.search.includes('knowledge_check')
        ? JSON.stringify({
            id: '000000c3-0009-0000-0000-000000000003',
            course_version_id: CV,
            title: 'Check',
            kind: 'knowledge_check',
            content_ref: {},
          })
        : JSON.stringify({
            id: '000000c3-0009-0000-0000-000000000001',
            course_version_id: CV,
            title: 'Anatomy of a Door',
            kind: 'lesson',
            content_ref: { mdx_key: 'ac-101/u1' },
          });
    return route.fulfill({ status: 200, headers, body });
  });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?screen=lesson&unit=000000c3-0009-0000-0000-000000000001');
  // The paced step runner opens on the teaching step (the 2D sim + Callout + the outline
  // rail); scan it, then walk Next to the terminal knowledge-check step and scan that too.
  await page.getByTestId('i2d-submit').waitFor(); // teaching step mounted
  const teaching = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(teaching.violations).toEqual([]);
  const kc = page.getByTestId('knowledge-check');
  for (let i = 0; i < 8 && (await kc.count()) === 0; i += 1) {
    await page.getByTestId('lesson-next').click();
  }
  await kc.waitFor(); // embedded check mounted on the terminal step
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});
