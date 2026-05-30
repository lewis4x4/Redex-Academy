// @redex/ui — MOTION TOKENS (D1). Durations + easings + the keyframe library.
// EVERY animation that uses these is gated behind prefers-reduced-motion (see
// styles/keyframes.css) — under the OS "reduce motion" setting, animations are
// disabled/calmed (invariant 7 / WCAG 2.3.3).
export const motion = {
  duration: {
    hover: '0.18s',
    nav: '0.22s',
    screen: '0.35s', // screen cross-fade
    meter: '0.45s', // progress/meter fill
    slideOver: '0.42s', // slide-over panel
    toast: '0.3s',
  },
  easing: {
    standard: 'ease',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
  // The keyframe library (defined in styles/keyframes.css; all reduced-motion-gated).
  keyframes: [
    'pulseGlow',
    'heartbeat',
    'bossPulse',
    'edgeDash',
    'twinkle',
    'fadeUp',
    'sealPop',
    'toastIn',
    'toastOut',
  ],
} as const;
