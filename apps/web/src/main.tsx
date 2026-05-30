import '@redex/ui/styles.css';
import { initI18n } from '@redex/i18n';
import { Gallery } from '@redex/ui/gallery';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { registerServiceWorker } from './registerSW';

initI18n();
registerServiceWorker();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

// Public dev route: the D1 component gallery (/dev/ui) — the reviewable artifact
// for the human-verify gate. Everything else renders the auth-aware app shell.
const isGallery = window.location.pathname === '/dev/ui';

createRoot(rootEl).render(<StrictMode>{isGallery ? <Gallery /> : <App />}</StrictMode>);
