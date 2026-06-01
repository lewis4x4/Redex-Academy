import { expect, test, type Route } from '@playwright/test';

// M6 — the Evaluator field sign-off ("Prove one"), end to end. No live Supabase in
// CI, so (a) seed a far-future fake EVALUATOR session, and (b) intercept the rubric
// template read + the finalize-signoff Edge Function. The finalize intercept RECOMPUTES
// the veto (any critical-safety line at 0 ⇒ fail) so the e2e exercises the real
// server contract. The DB-layer veto/immutability is proven on a live Postgres by
// 0001 + 0004; the pass-rule + authz parity by the deno tests.

const SAFETY_KEYS = [
  'ac203.release_on_power_loss',
  'ac203.push_to_exit_30s',
  'ac203.armature_sealed_pull_test',
  'ac203.pte_mount_40_48in_5ft',
  'ac203.no_maglock_defeat_fire_latch',
  'ac203.emergency_lighting_present',
  'ac203.ahj_confirmed',
];
const TEMPLATES = [
  ...SAFETY_KEYS.map((k, i) => ({
    line_item_key: k,
    dimension: 'safety_compliance',
    is_critical_safety: true,
    ordinal: i + 1,
    label: k,
  })),
  {
    line_item_key: 'ac203.tech.fail_safe_wiring',
    dimension: 'technical_execution',
    is_critical_safety: false,
    ordinal: 8,
    label: 'fail-safe wiring',
  },
  {
    line_item_key: 'ac203.tech.rex_fire_terminated',
    dimension: 'technical_execution',
    is_critical_safety: false,
    ordinal: 9,
    label: 'REX/fire terminated',
  },
  {
    line_item_key: 'ac203.tech.supply_battery_sized',
    dimension: 'technical_execution',
    is_critical_safety: false,
    ordinal: 10,
    label: 'supply sized',
  },
  {
    line_item_key: 'ac203.verify.three_release_modes_logged',
    dimension: 'verification_documentation',
    is_critical_safety: false,
    ordinal: 11,
    label: 'both modes + pull test logged',
  },
  {
    line_item_key: 'ac203.indep.recognize_no_maglock_escalate',
    dimension: 'independence_judgment',
    is_critical_safety: false,
    ordinal: 12,
    label: 'escalated',
  },
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
      sub: '00000000-0000-0000-0000-0000000000d4',
      org_id: '00000000-0000-0000-0000-0000000000a1',
      roles: ['evaluator'],
      evaluator_authorized: true,
      domains: ['AC'],
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

  // finalize-signoff (service-role) — recompute the veto so the e2e exercises the
  // real contract: a single critical-safety 0 ⇒ non-overridable fail (no promotion).
  await page.route('**/functions/v1/finalize-signoff', async (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: CORS, body: '' });
    const body = JSON.parse(route.request().postData() ?? '{}') as {
      scores?: Record<string, number>;
    };
    const scores = body.scores ?? {};
    const vetoed = SAFETY_KEYS.some((k) => scores[k] === 0);
    const allOk =
      Object.values(scores).every((s) => s >= 2) && Object.keys(scores).length === TEMPLATES.length;
    if (vetoed || !allOk) {
      return json(route, {
        signoff_id: 'x',
        status: 'failed',
        outcome: 'fail',
        safety_veto_triggered: vetoed,
        promoted: false,
      });
    }
    return json(route, {
      signoff_id: 'x',
      status: 'signed',
      outcome: 'pass',
      safety_veto_triggered: false,
      promoted: true,
    });
  });
  await page.route('**/functions/v1/finalize-sim-attempt', (route) =>
    json(route, { outcome: 'pass' }),
  );

  await page.route('**/rest/v1/**', (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: CORS, body: '' });
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/signoff_line_item_templates')) return json(route, TEMPLATES);
    return json(route, []); // courses/prereqs/etc. for the home Constellation
  });
});

async function openSignoff(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('shell')).toHaveText('dense'); // past the auth gate
  await page.getByTestId('open-signoff').click(); // the evaluator-gated entry
  await expect(page.getByTestId('candidate-input')).toBeVisible(); // sign-off screen mounted
  await page.getByTestId('candidate-input').fill('00000000-0000-0000-0000-0000000000c3');
  await page.getByTestId('job-input').fill('00000000-0000-0000-0000-0000000000b0');
}

async function scoreAll(page: import('@playwright/test').Page, value: number) {
  const lines = page.locator('[data-line]');
  const n = await lines.count();
  for (let i = 0; i < n; i++) {
    await lines.nth(i).locator(`[data-score="${value}"]`).click();
  }
}

test('evaluator scores an all-passing rubric → finalize PASSES and promotes competency', async ({
  page,
}) => {
  await openSignoff(page);
  await scoreAll(page, 2);
  await expect(page.getByTestId('verdict-preview')).toHaveAttribute('data-outcome', 'pass');
  await page.getByTestId('finalize').click();
  const result = page.getByTestId('result');
  await expect(result).toHaveAttribute('data-status', 'signed');
  await expect(result).toHaveAttribute('data-outcome', 'pass');
});

test('a single critical-safety 0 VETOES — the UI blocks signing-as-pass and the server records a fail', async ({
  page,
}) => {
  await openSignoff(page);
  await scoreAll(page, 2);
  // drop one critical-safety line to 0 — the non-overridable veto
  await page.locator('[data-line="ac203.ahj_confirmed"] [data-score="0"]').click();
  await expect(page.getByTestId('verdict-preview')).toHaveAttribute('data-outcome', 'safety_veto');
  await expect(page.getByTestId('veto-banner')).toBeVisible();
  // the sign control is relabeled to record-a-fail (you cannot sign-as-pass through a veto)
  await expect(page.getByTestId('finalize')).toHaveText(/Record sign-off/i);
  await page.getByTestId('finalize').click();
  const result = page.getByTestId('result');
  await expect(result).toHaveAttribute('data-status', 'failed');
  await expect(result).toHaveAttribute('data-outcome', 'fail');
});

test('OFFLINE: finalize is disabled (server-only) — no pass can be granted offline', async ({
  page,
  context,
}) => {
  await openSignoff(page);
  await scoreAll(page, 2);
  await context.setOffline(true);
  await expect(page.getByTestId('finalize')).toBeDisabled();
  await expect(page.getByText(/Finalizing requires a connection/i)).toBeVisible();
});
