import '@redex/ui/styles.css';
import { initI18n } from '@redex/i18n';
import { Gallery } from '@redex/ui/gallery';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthCallback } from './auth/components/AuthCallback';
import { supabase } from './auth/supabaseClient';
import { ForgePreview } from './forge/ForgePreview';
import './index.css';
import { startSync } from './offline/sync-manager';
import { registerServiceWorker } from './registerSW';
import { UpdatePrompt } from './UpdatePrompt';

initI18n();
registerServiceWorker();

// Drain the offline queue: once at startup and on every `online` event, with
// exponential backoff on failure. The flush sends the SAME client_event_uuid
// each time → the idempotent /sync (ON CONFLICT DO NOTHING) cannot double-count.
// A failed POST (e.g. auth) THROWS and leaves events queued — never marked done.
// getToken is now wired to the authenticated session (F3 landed): the access token
// is tracked from the live session so queued sim attempts actually reach /sync.
const syncUrl = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/sync`;
let accessToken: string | undefined;
void supabase.auth.getSession().then(({ data }) => {
  accessToken = data.session?.access_token;
});
supabase.auth.onAuthStateChange((_event, next) => {
  accessToken = next?.access_token;
});
if (import.meta.env.VITE_SUPABASE_URL) {
  startSync({ syncUrl, getToken: () => accessToken });
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

// Public standalone routes (no auth): the D1 component gallery (/dev/ui — the
// reviewable artifact for the visual gate) and the F5 Forge preview/sandbox
// (/forge-preview — the authoring preview). Everything else renders the
// auth-aware app shell.
const path = window.location.pathname;
const route =
  path === '/dev/ui' ? (
    <Gallery />
  ) : path === '/forge-preview' ? (
    <ForgePreview />
  ) : path === '/auth/callback' ? (
    <AuthCallback />
  ) : (
    <App />
  );

createRoot(rootEl).render(
  <StrictMode>
    {route}
    {/* Always mounted: shows the "new version — reload" prompt on any route. */}
    <UpdatePrompt />
  </StrictMode>,
);
