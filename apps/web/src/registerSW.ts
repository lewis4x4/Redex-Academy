// Placeholder service-worker registration.
//
// The real offline PWA — Workbox precache of the app shell, on-demand course
// "field packs", Dexie stores, and the idempotent /sync path — is built in F4.
// This is a typed no-op so the shell is a PWA shell without faking offline
// behavior. Never register a SW that could cache stale state or let a tech
// "pass" offline (CLAUDE.md invariant §5: never fake a pass offline).
export function registerServiceWorker(): void {
  // Intentionally empty until F4 (Workbox: no-cache on the SW, long-cache on
  // hashed assets).
}
