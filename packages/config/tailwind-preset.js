// Shared Tailwind preset for the Redex Academy apps.
// Colorblind-safe note (CODING_STANDARDS.md §9, CLAUDE.md invariant context):
// state is NEVER encoded by color alone — pair every status color with a shape
// + text token. The `state` palette below is paired with iconography in
// `@redex/ui` primitives; do not use these colors as the sole carrier of meaning.
/** @type {Partial<import('tailwindcss').Config>} */
export default {
  theme: {
    extend: {
      colors: {
        // Brand
        redex: {
          DEFAULT: '#0b3d91',
          fg: '#0b3d91',
        },
        // Status palette — ALWAYS paired with shape + text (never color-only).
        state: {
          pass: '#1b7f37',
          fail: '#b3261e',
          veto: '#7a1fa2',
          pending: '#8a6d00',
        },
      },
    },
  },
  plugins: [],
};
