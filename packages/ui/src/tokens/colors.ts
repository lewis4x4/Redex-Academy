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
  redBright: '#ff5b62', // v2 red-soft (small-text / accent red, AA on dark surfaces)
  redDeep: '#8f0e14',
  redDim: '#241114', // v2 faint red wash behind a fail/hot surface
  black: '#000000',

  // Surfaces (near-black dark canvas + layered panels — v2 bar values)
  canvas: '#0a0a0c',
  panel: '#131316',
  panel2: '#1a1a1f',
  line: '#26262d',
  lineStrong: '#34343d', // v2 brighter hairline (index/chip/rail-number stroke)

  // Text (v2: OFF-WHITE body, not pure white)
  text: '#e9e9ee',
  textStrong: '#ffffff', // pure-white keyword emphasis (.kw)
  muted: '#9a9aa6',
  dim: '#65656f',

  // State — ALWAYS paired with shape + text (never color-only; invariant 7)
  pass: '#39d98a', // v2 green
  fail: '#b3261e',
  veto: '#7a1fa2',
  pending: '#f5a623', // amber
  gold: '#f5c451', // mastered
  tech: '#ffd9a0', // v2 technical-value accent (warm gold)

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
