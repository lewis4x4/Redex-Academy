import '@redex/ui/styles.css';
import { initI18n } from '@redex/i18n';
import { Gallery } from '@redex/ui/gallery';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ForgePreview } from './forge/ForgePreview';
import './index.css';
import { startSync } from './offline/sync-manager';
import { registerServiceWorker } from './registerSW';

initI18n();
registerServiceWorker();

// Drain the offline queue: once at startup and on every `online` event, with
// exponential backoff on failure. The flush sends the SAME client_event_uuid
// each time → the idempotent /sync (ON CONFLICT DO NOTHING) cannot double-count.
// A failed POST (e.g. auth) THROWS and leaves events queued — never marked done.
// getToken is wired to the authenticated session in main.tsx after F3 lands.
const syncUrl = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/sync`;
if (import.meta.env.VITE_SUPABASE_URL) {
  startSync({ syncUrl });
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

// Public standalone routes (no auth): the D1 component gallery (/dev/ui — the
// reviewable artifact for the visual gate) and the F5 Forge preview/sandbox
// (/forge-preview — the authoring preview). Everything else renders the
// auth-aware app shell.
const path = window.location.pathname;
const devView =
  path === '/dev/ui' ? <Gallery /> : path === '/forge-preview' ? <ForgePreview /> : null;

createRoot(rootEl).render(<StrictMode>{devView ?? <App />}</StrictMode>);
