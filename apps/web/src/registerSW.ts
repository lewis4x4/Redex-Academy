import { registerSW } from 'virtual:pwa-register';

/**
 * Register the Workbox service worker (F4) and wire the EXPLICIT update flow.
 *
 * `registerType` is `'prompt'`: a freshly deployed SW installs but stays in the
 * `waiting` state — it never swaps mid-sim. We surface a clickable "reload to
 * update" prompt ({@link ./UpdatePrompt} listens for {@link SW_UPDATE_EVENT})
 * and only skip-waiting + reload when the user accepts. A long-lived tab also
 * re-checks for a new deploy periodically and whenever it regains focus, so a
 * tech who leaves the PWA open still sees the prompt without a manual reload.
 *
 * Without this wiring the `prompt` SW would sit `waiting` until every tab closed,
 * which is exactly how a deploy "looks cached": the page keeps being served from
 * the OLD precache. Capturing `updateServiceWorker` (the fn `registerSW` returns)
 * is what lets the prompt actually apply the update.
 *
 * The SW only precaches the app shell + runtime-caches catalog/assets; it NEVER
 * caches server-authoritative state or fakes a pass (that lives in /sync).
 */

/** Fired (on `window`) when a new SW is waiting and the user should be prompted. */
export const SW_UPDATE_EVENT = 'redex:sw-update-available';
/** Fired (on `window`) when the app shell is cached and ready to work offline. */
export const SW_OFFLINE_READY_EVENT = 'redex:sw-offline-ready';

// How often a FOREGROUNDED tab asks the SW to check the server for a new deploy.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly

// Captured from registerSW(): skip-waits the waiting SW and reloads when called
// with `true`. The plugin guards its own controllerchange reload (no reload loop).
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
let updatePending = false;

/** True if a new version is waiting to be applied (prompt should be shown). */
export function isUpdatePending(): boolean {
  return updatePending;
}

/** Accept the waiting update: skip-waiting + reload. No-op if none is pending. */
export function applyUpdate(): void {
  if (updateSW) void updateSW(true);
}

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updatePending = true;
      window.dispatchEvent(new CustomEvent(SW_UPDATE_EVENT));
    },
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent(SW_OFFLINE_READY_EVENT));
    },
    onRegisteredSW(_swScriptUrl, registration) {
      if (!registration) return;
      // Ask the SW to re-check the server for a new deploy on an interval and
      // whenever the tab is refocused — only while visible (no background churn).
      const check = () => {
        if (document.visibilityState === 'visible') void registration.update();
      };
      setInterval(check, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', check);
    },
  });
}
