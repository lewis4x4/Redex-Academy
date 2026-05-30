// @redex/ui — TYPOGRAPHY TOKENS (D1). Extracted from the prototype.
export const typography = {
  fontSans:
    "Inter, 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontMono: "ui-monospace, 'SF Mono', Menlo, Monaco, monospace",

  // Weight scale: body 400/500, nav 600, label 700, bold 800, display 900.
  weight: {
    regular: '400',
    medium: '500',
    nav: '600',
    label: '700',
    bold: '800',
    display: '900',
  },

  // Size scale (px). Eyebrow/label are uppercase + tracked; big titles use negative tracking.
  size: {
    eyebrow: '10px',
    label: '11px',
    hud: '9px',
    caption: '12px',
    body: '13px',
    bodyLg: '14px',
    nav: '13px',
    subtitle: '16px',
    statValue: '17px',
    title: '20px',
    h1: '26px',
    display: '34px',
    displayLg: '40px',
  },

  // Letter-spacing (tracking). Eyebrow/label uppercase 2–5px; big titles negative.
  tracking: {
    eyebrow: '3px',
    label: '2px',
    hud: '2px',
    nav: '0.3px',
    name: '0.5px',
    tightTitle: '-0.4px',
    tightMark: '-1px',
  },

  lineHeight: {
    tight: '1.05',
    snug: '1.25',
    normal: '1.5',
  },
} as const;
