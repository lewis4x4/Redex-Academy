// Shared ESLint flat config for the Redex Academy monorepo.
// Non-type-checked rule set (fast + robust across the workspace); F-tier goals
// may layer type-aware rules on top per package. CODING_STANDARDS.md §1: no `any`.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node, ...globals.es2021 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Invariant: no untyped escape hatch without a justified inline exception.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  // Node/tooling scripts (infra, config) may use console + process freely.
  {
    files: ['infra/**/*.ts', '**/*.config.{ts,js}', '**/vite.config.ts', '**/playwright.config.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // ── D1 invariant 9: NO raw color hex outside the token layer. Components, the
  // shell, templates, the gallery, and app screens must use @redex/ui tokens /
  // Tailwind classes (backed by CSS variables) — never a literal hex. The token
  // layer (packages/ui/src/tokens/**) + tokens.css + the Tailwind preset are the
  // ONLY places a hex may live; they are excluded below.
  {
    files: [
      'packages/ui/src/components/**/*.{ts,tsx}',
      'packages/ui/src/shell/**/*.{ts,tsx}',
      'packages/ui/src/templates/**/*.{ts,tsx}',
      'packages/ui/src/gallery/**/*.{ts,tsx}',
      'packages/ui/src/StatusBadge.tsx',
      'apps/web/src/**/*.{ts,tsx}',
      'apps/admin/src/**/*.{ts,tsx}',
    ],
    ignores: ['**/*.test.{ts,tsx}', '**/tokens/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
          message:
            'Raw color hex is forbidden outside the token layer (D1 invariant 9) — use a @redex/ui token or a Tailwind class backed by a CSS variable.',
        },
        {
          selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}/]',
          message:
            'Raw color hex is forbidden outside the token layer (D1 invariant 9) — use a @redex/ui token or a Tailwind class backed by a CSS variable.',
        },
      ],
    },
  },
  prettier,
);
