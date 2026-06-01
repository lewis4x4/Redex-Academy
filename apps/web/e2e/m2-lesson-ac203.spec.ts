import { expect, test, type Route } from '@playwright/test';

// M2 — the FLAGSHIP AC-203 MDX lesson with an embedded retry-to-mastery knowledge
// check, end to end. Mirrors m2-lesson.spec.ts (AC-101) exactly, adapted to AC-203:
// the 4 embedded interaction_2d sims, and the real 12-item check (9 safety + 3
// non-safety). No live Supabase in CI, so (a) seed a far-future fake session, (b)
// intercept the academy PostgREST reads (units + assessment_items) with a
// deterministic fixture, and (c) intercept the grade-knowledge-check Edge Function.
// The gate ALGORITHM (safety ≥90% / non-safety ≥80%, split by is_safety_item) is
// proven exhaustively by the unit + Deno tests; this proves the wiring: render →
// answer → blocked on a safety miss → retry → pass, plus the EN↔ES toggle and the
// offline path.

const LESSON_UNIT = '000000c3-000e-0000-0000-000000000001'; // AC-203 u1 (mdx_key ac-203/u1)
const KC_UNIT = '000000c3-000e-0000-0000-000000000005';
const CV = '000000c2-0000-0000-0000-00000000000e'; // AC-203 active version
const COMP = '000000c0-0000-0000-0000-00000000000f';

const LESSON_UNIT_ROW = {
  id: LESSON_UNIT,
  course_version_id: CV,
  title: 'Mag Locks, REX & Basic Egress Wiring',
  kind: 'lesson',
  content_ref: { mdx_key: 'ac-203/u1' },
};
const KC_UNIT_ROW = {
  id: KC_UNIT,
  course_version_id: CV,
  title: 'Egress Wiring Knowledge Check',
  kind: 'knowledge_check',
  content_ref: { item_set: 'ac-203' },
};

// AC-203's real check is 12 items: 9 safety + 3 non-safety; correct answer is 'a' for all.
const SAFETY_IDS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'];
const NON_SAFETY_IDS = ['n1', 'n2', 'n3'];
const ITEMS = [
  ...SAFETY_IDS.map((id) => mk(id, true)),
  ...NON_SAFETY_IDS.map((id) => mk(id, false)),
];
function mk(id: string, safety: boolean) {
  return {
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
  };
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
};
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

test.beforeEach(async ({ page }) => {
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

  // The server-only verdict (grade-knowledge-check): the FIRST graded attempt (the
  // safety miss) is not-passed; the retry passes. Responses are recorded via /sync
  // (Dexie → Edge Function), never a direct PostgREST POST, so we drive the verdict
  // off the invocation count — the server re-derives authoritatively in production.
  let gradeCalls = 0;
  await page.route('**/functions/v1/grade-knowledge-check', (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: CORS, body: '' });
    gradeCalls += 1;
    const passed = gradeCalls >= 2;
    return json(route, { passed, promoted: passed ? COMP : null });
  });
  await page.route('**/functions/v1/sync', (route) => json(route, { accepted: [], rejected: [] }));

  await page.route('**/rest/v1/**', (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
    const url = new URL(route.request().url());
    const path = url.pathname;
    const q = url.search;
    if (path.endsWith('/assessment_items')) return json(route, ITEMS);
    if (path.endsWith('/units')) {
      if (q.includes('knowledge_check')) return json(route, KC_UNIT_ROW); // maybeSingle
      return json(route, LESSON_UNIT_ROW); // maybeSingle by id
    }
    if (path.endsWith('/competency_state')) return json(route, []);
    return json(route, []);
  });
});

const openLesson = async (page: import('@playwright/test').Page) => {
  await page.goto(`/?screen=lesson&unit=${LESSON_UNIT}`);
  await expect(page.getByTestId('lesson-body')).toBeVisible();
};

test('lesson renders via MDX with the embedded 2D sims + knowledge check', async ({ page }) => {
  await openLesson(page);
  await expect(page.getByRole('note').first()).toHaveAttribute('data-tone', 'safety'); // <Callout tone="safety">
  // All 4 embedded sims are ac-203/* interaction_2d specs (in M2_AC_SPECS) → they
  // mount the Interaction2dSim engine (i2d-submit), NOT sim-missing / sim-unsupported.
  await expect(page.getByTestId('sim-missing')).toHaveCount(0);
  await expect(page.getByTestId('sim-unsupported')).toHaveCount(0);
  await expect(page.getByTestId('i2d-submit').first()).toBeVisible(); // <Sim> mounted
  await expect(page.getByTestId('knowledge-check')).toBeVisible();
});

test('retry-to-mastery: a safety miss is BLOCKED; fixing it PASSES', async ({ page }) => {
  await openLesson(page);
  const kc = page.getByTestId('knowledge-check');
  // miss one safety item (s1 = 'b'), everything else correct → safety 8/9 = 88.9% < 90%
  await kc.locator('[data-item="s1"] [data-choice="b"]').click();
  for (const id of [...SAFETY_IDS.slice(1), ...NON_SAFETY_IDS])
    await kc.locator(`[data-item="${id}"] [data-choice="a"]`).click();
  await page.getByTestId('kc-submit').click();
  await expect(page.getByTestId('kc-verdict')).toContainText('retry');
  await expect(page.getByTestId('kc-local-pass')).toHaveText('false'); // the real gate blocked it
  await expect(page.getByTestId('kc-retry')).toBeVisible();

  // retry: fix the safety answer → all correct → passes
  await page.getByTestId('kc-retry').click();
  await kc.locator('[data-item="s1"] [data-choice="a"]').click();
  await page.getByTestId('kc-submit').click();
  await expect(page.getByTestId('kc-verdict')).toContainText('Mastered');
});

test('EN↔ES locale toggle flips the check chrome; the lesson still renders', async ({ page }) => {
  await openLesson(page);
  await expect(page.getByTestId('kc-submit')).toHaveText('Check answers');
  await page.getByTestId('lesson-locale-toggle').click();
  await expect(page.getByTestId('kc-submit')).toHaveText('Comprobar respuestas');
  await expect(page.getByTestId('lesson-body')).toBeVisible();
});

test('OFFLINE: a submitted check queues + shows "completes on reconnect", never a faked pass', async ({
  page,
  context,
}) => {
  await openLesson(page);
  await context.setOffline(true);
  const kc = page.getByTestId('knowledge-check');
  for (const id of [...SAFETY_IDS, ...NON_SAFETY_IDS])
    await kc.locator(`[data-item="${id}"] [data-choice="a"]`).click();
  await page.getByTestId('kc-submit').click();
  await expect(page.getByTestId('kc-verdict')).toContainText('offline'); // pending, not a pass
});
