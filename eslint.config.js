// Root ESLint flat config — applies the shared @redex/config preset across the
// whole workspace in a single pass (see root `lint` script). Generated artifacts
// (database.types.ts) and build output are never linted.
import preset from '@redex/config/eslint-preset';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      // Generated, committed artifacts — never hand-edited, never linted.
      '**/database.types.ts',
      '**/*.gen.ts',
      // Build-kit authored sources scaffolded by other goals (SQL/JSON specs).
      'migrations/**',
      'seed/**',
      'sim-contracts/**',
      'supabase/migrations/**',
      'supabase/tests/**',
      // Deno Edge Functions are a separate runtime (npm:/jsr: imports, Deno.*);
      // checked by `deno check` in CI, not the node ESLint/Prettier toolchain.
      'supabase/functions/**',
    ],
  },
  ...preset,
];
