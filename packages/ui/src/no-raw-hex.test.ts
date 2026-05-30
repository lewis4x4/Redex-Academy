import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// Self-test for the D1 invariant-9 lint rule: a raw color hex in a component file
// MUST fail lint, while the token-class equivalent passes. Lints against the REAL
// repo eslint config (not a mock), so the committed rule is what's exercised.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const eslint = new ESLint({ cwd: repoRoot });

const lint = async (code: string, file: string) => {
  const [res] = await eslint.lintText(code, { filePath: resolve(repoRoot, file) });
  return res?.messages ?? [];
};

describe('no-raw-hex lint rule (D1 invariant 9)', () => {
  it('FAILS on a raw color hex in a component file (planted violation)', async () => {
    const msgs = await lint(
      "export const c = '#ED1B24';\n",
      'packages/ui/src/components/__probe.tsx',
    );
    expect(msgs.some((m) => m.ruleId === 'no-restricted-syntax')).toBe(true);
  });

  it('PASSES when the same color is expressed as a token class', async () => {
    const msgs = await lint(
      "export const c = 'bg-redex text-white shadow-glow';\n",
      'packages/ui/src/components/__probe.tsx',
    );
    expect(msgs.some((m) => m.ruleId === 'no-restricted-syntax')).toBe(false);
  });

  it('EXEMPTS the token layer (raw hex is allowed there — it is the source)', async () => {
    const msgs = await lint("export const red = '#ED1B24';\n", 'packages/ui/src/tokens/__probe.ts');
    expect(msgs.some((m) => m.ruleId === 'no-restricted-syntax')).toBe(false);
  });
});
