// @redex/ui — COLOR TOKENS (the single source of truth, D1).
//
// THIS FILE + tokens.css are the ONLY places a raw color hex may appear (the
// no-raw-hex ESLint rule exempts packages/ui/src/tokens/**). Everywhere else —
// components, screens, the shell — reads these via Tailwind classes (mapped to the
// CSS variables in styles/tokens.css) or the `colors` export below. Values are
// extracted from Redex_Academy_Prototype.html (the approved prototype) + D1.md §1.
//
// Dark is the brand default. The placeholder navy #0b3d91 is GONE; brand is #ED1B24.

export const colors = {
  // Brand
  red: '#ED1B24',
  redBright: '#ff3b43',
  redDeep: '#8f0e14',
  black: '#000000',

  // Surfaces (near-black dark canvas + layered panels)
  canvas: '#0a0a0c',
  panel: '#121216',
  panel2: '#17171d',
  line: '#26262e',

  // Text
  text: '#ffffff',
  muted: '#9a9aa6',
  dim: '#5a5a66',

  // State — ALWAYS paired with shape + text (never color-only; invariant 7)
  pass: '#36d399',
  fail: '#b3261e',
  veto: '#7a1fa2',
  pending: '#f5a623', // amber
  gold: '#f5c451', // mastered

  // Domain hues
  domainFnd: '#c9ced6',
  domainInt: '#e0584f',
  domainAdc: '#6fb0e0',
  domainAc: '#e0b15f',
  domainVid: '#7fd0a8',
  domainSec: '#b89fe0',
} as const;

export type ColorToken = keyof typeof colors;

/** The six learning-domain codes → their token name. */
export const DOMAIN_COLOR: Record<string, ColorToken> = {
  FND: 'domainFnd',
  INT: 'domainInt',
  ADC: 'domainAdc',
  AC: 'domainAc',
  VID: 'domainVid',
  SEC: 'domainSec',
};
