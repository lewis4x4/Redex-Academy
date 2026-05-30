import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { colors } from './colors';

// Token snapshot + single-source guard (D1). Asserts the TS color tokens and the
// CSS-variable source agree, the brand is #ED1B24, and the placeholder navy is gone
// from the whole design layer (the no-raw-hex rule + this test together enforce
// "tokens are the single source").
const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');
const tokensCss = read('../styles/tokens.css');
const tailwindPreset = read('../../../config/tailwind-preset.js');

describe('@redex/ui tokens — single source of truth', () => {
  it('the brand is #ED1B24 and the placeholder navy #0b3d91 is GONE', () => {
    expect(colors.red.toLowerCase()).toBe('#ed1b24');
    expect(tokensCss.toLowerCase()).toContain('#ed1b24');
    expect(tokensCss.toLowerCase()).not.toContain('#0b3d91');
    expect(tailwindPreset.toLowerCase()).not.toContain('#0b3d91');
  });

  it('every TS color token appears as a value in tokens.css (TS ↔ CSS agree)', () => {
    const css = tokensCss.toLowerCase();
    const missing = Object.entries(colors)
      .filter(([, hex]) => !css.includes(hex.toLowerCase()))
      .map(([name]) => name);
    expect(missing).toEqual([]);
  });

  it('the Tailwind preset references CSS variables, not raw hex (theming from one place)', () => {
    // Brand/surface colors in the preset must be var(--…), never a literal hex.
    expect(tailwindPreset).toMatch(/var\(--red\)/);
    expect(tailwindPreset).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  // The no-raw-hex ESLint rule only covers .ts/.tsx — these STATIC brand surfaces
  // (browser theme-color, the PWA manifest, the app/launcher icons) carry a literal
  // hex by necessity, so guard them here: the placeholder navy must be gone and the
  // brand red must be present. (Closes the gap that let navy ship in the app shell.)
  it('the live app brand surfaces (theme-color / manifest / icons) are brand-red, not navy', () => {
    const surfaces = [
      '../../../../apps/web/index.html',
      '../../../../apps/admin/index.html',
      '../../../../apps/web/public/manifest.webmanifest',
      '../../../../apps/web/public/icon.svg',
      '../../../../apps/admin/public/icon.svg',
    ];
    for (const rel of surfaces) {
      const content = read(rel).toLowerCase();
      expect(content, `${rel} must not contain the placeholder navy`).not.toContain('#0b3d91');
      expect(content, `${rel} must carry the brand red`).toContain('#ed1b24');
    }
  });
});
