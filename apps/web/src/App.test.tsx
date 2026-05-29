import { initI18n } from '@redex/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

// Deterministic auth: a mutable holder the mocked client reads (vi.hoisted so the
// mock factory may reference it).
const h = vi.hoisted(() => ({ session: null as { access_token: string } | null }));
vi.mock('./auth/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: h.session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}));

const b64url = (obj: unknown) =>
  btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const tokenWith = (claims: unknown) => `h.${b64url(claims)}.s`;

const ORG = '00000000-0000-0000-0000-0000000000a1';
const SUB = '00000000-0000-0000-0000-0000000000c3';

describe('App (auth-aware shell)', () => {
  it('logged out → renders the SSO login screen', async () => {
    h.session = null;
    initI18n();
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Redex Academy');
    expect(screen.getByRole('button', { name: /Google Workspace/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Microsoft Entra/i })).toBeTruthy();
  });

  it('logged in as Marco + manager → field-first shell + role-gated manager section', async () => {
    h.session = {
      access_token: tokenWith({ sub: SUB, org_id: ORG, roles: ['manager'], persona: 'marco' }),
    };
    initI18n();
    render(<App />);
    expect(await screen.findByTestId('shell')).toHaveTextContent('field'); // persona drives UI
    expect(screen.getByLabelText('Manager tools')).toBeTruthy(); // roles drive permission
  });

  it('logged in as a learner → no manager section (role gate hides it)', async () => {
    h.session = {
      access_token: tokenWith({ sub: SUB, org_id: ORG, roles: ['learner'], persona: 'priya' }),
    };
    initI18n();
    render(<App />);
    expect(await screen.findByTestId('shell')).toHaveTextContent('dense');
    expect(screen.queryByLabelText('Manager tools')).toBeNull();
  });
});
