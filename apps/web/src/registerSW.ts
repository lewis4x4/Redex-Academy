import { registerSW } from 'virtual:pwa-register';

/**
 * Register the Workbox service worker (F4). registerType 'prompt': when a new SW
 * is waiting we surface an EXPLICIT update prompt rather than silently swapping
 * mid-sim. The SW only precaches the app shell + runtime-caches catalog/assets;
 * it NEVER caches server-authoritative state or fakes a pass (that lives in the
 * idempotent /sync path).
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onNeedRefresh() {
      window.dispatchEvent(new CustomEvent('redex:sw-update-available'));
    },
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent('redex:sw-offline-ready'));
    },
  });
}
