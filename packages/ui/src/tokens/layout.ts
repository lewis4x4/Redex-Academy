// @redex/ui — SPACE / RADIUS / SHADOW / GLOW TOKENS (D1). From the prototype.
export const layout = {
  // Spacing scale (px) — the prototype's padding/gap rhythm.
  space: {
    '0': '0',
    '1': '4px',
    '2': '6px',
    '3': '8px',
    '4': '10px',
    '5': '12px',
    '6': '14px',
    '7': '16px',
    '8': '18px',
    '9': '22px',
    '10': '24px',
    '11': '26px',
    '12': '32px',
    '13': '40px',
  },

  // Radii: pill (nav/backpack), card/panel, brand mark, controls.
  radius: {
    mark: '8px',
    control: '9px',
    chip: '9px',
    card: '14px',
    panel: '16px',
    legend: '14px',
    pill: '30px',
    full: '9999px',
  },

  // Elevation. Color is in rgba (the only place besides tokens.css raw rgba lives).
  shadow: {
    panel: '-20px 0 60px rgba(0,0,0,.6)',
    modal: '0 24px 80px rgba(0,0,0,.7)',
    toast: '0 12px 40px rgba(0,0,0,.5)',
    card: '0 2px 10px rgba(0,0,0,.4)',
  },

  // Brand glow (Redex red).
  glow: '0 0 18px rgba(237,27,36,.55)',
  glowSoft: '0 0 30px rgba(237,27,36,.25)',
} as const;
