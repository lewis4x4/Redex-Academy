import { initI18n } from '@redex/i18n';
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

// Public Forge preview/sandbox route (F5 §6) — no auth, so the authoring preview
// runs standalone; everything else goes through the auth-aware app shell.
const isForgePreview = window.location.pathname === '/forge-preview';

createRoot(rootEl).render(<StrictMode>{isForgePreview ? <ForgePreview /> : <App />}</StrictMode>);
