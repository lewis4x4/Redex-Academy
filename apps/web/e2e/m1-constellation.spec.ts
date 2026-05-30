import { expect, test, type Route } from '@playwright/test';

// M1 — the Constellation home, end to end (browse → see gating → enroll an
// available course → blocked on a locked one). There is no live Supabase in CI,
// so we (a) seed a far-future fake session into the storage key supabase-js reads
// (decoded client-side only; drives the REAL logged-in shell + Constellation), and
// (b) intercept the academy PostgREST reads/writes with a deterministic fixture
// graph. This proves the resolver + UI wiring in a real browser without a backend;
// the gating ALGORITHM is proven exhaustively by the unit test (src/catalog/
// gating.test.ts) and the server-side SQL test (docs/m1-server-resolver/).

const ROOT1 = '000000c1-0000-0000-0000-0000000000a1'; // FND-101 (root)
const ROOT2 = '000000c1-0000-0000-0000-0000000000a2'; // AC-201 (root)
const GATE = '000000c1-0000-0000-0000-00000000000e'; // AC-203 (requires both → boss)

const COURSES = [
  {
    id: ROOT1,
    code: 'FND-101',
    title: 'Welcome to Redex',
    domain: 'FND',
    tier: 'foundations',
    personas: ['priya'],
    active_version_id: '000000c2-0000-0000-0000-0000000000a1',
    status: 'published',
  },
  {
    id: ROOT2,
    code: 'AC-201',
    title: 'Single-Door Install',
    domain: 'AC',
    tier: 'core',
    personas: ['priya'],
    active_version_id: '000000c2-0000-0000-0000-0000000000a2',
    status: 'published',
  },
  {
    id: GATE,
    code: 'AC-203',
    title: 'Mag Locks, REX & Egress',
    domain: 'AC',
    tier: 'core',
    personas: ['priya'],
    active_version_id: '000000c2-0000-0000-0000-00000000000e',
    status: 'published',
  },
];
const PREREQS = [
  { course_id: GATE, requires_course_id: ROOT1, kind: 'hard_gate' },
  { course_id: GATE, requires_course_id: ROOT2, kind: 'hard_gate' },
];

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

  // Deterministic academy catalog + own-progress reads. `enrolled` flips when the
  // self-enroll POST lands, so the reload reflects the new in_progress state.
  let enrolled = false;
  await page.route('**/rest/v1/**', (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
    const path = new URL(route.request().url()).pathname;
    if (method === 'POST' && path.endsWith('/enrollments')) {
      enrolled = true;
      return json(route, [{ id: '000000e1-0000-0000-0000-000000000001' }], 201);
    }
    if (path.endsWith('/courses')) return json(route, COURSES);
    if (path.endsWith('/course_prerequisites')) return json(route, PREREQS);
    if (path.endsWith('/enrollments'))
      return json(route, enrolled ? [{ course_id: ROOT1, status: 'in_progress' }] : []);
    // units, competency_state, credentials → empty for this scenario
    return json(route, []);
  });
});

test('browse the constellation → enroll an available course → a locked gate is blocked', async ({
  page,
}) => {
  await page.goto('/');

  // Past the auth gate into the real logged-in shell (priya → dense).
  await expect(page.getByTestId('shell')).toHaveText('dense');

  // BROWSE + SEE GATING: roots are available; the AC-203 egress gate is a locked boss.
  const root = page.locator('[data-course="FND-101"]');
  const gate = page.locator('[data-course="AC-203"]');
  await expect(root).toHaveAttribute('data-state', 'available');
  await expect(gate).toHaveAttribute('data-state', 'locked');
  await expect(gate).toHaveAttribute('data-boss', 'true');

  // ENROLL an AVAILABLE course → unmissable confirmation, no error.
  await root.click();
  const enroll = page.getByRole('button', { name: /^Enroll$/ });
  await expect(enroll).toBeVisible();
  await enroll.click();
  await expect(page.getByText('Enrolled in FND-101.')).toBeAttached();

  // BLOCKED ON LOCKED: selecting the locked gate offers NO enroll, shows the hint.
  await gate.click();
  await expect(page.getByText(/Pass its prerequisite courses to unlock/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Enroll$/ })).toHaveCount(0);
});
