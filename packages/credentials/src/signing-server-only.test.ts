// ============================================================================
// signing-server-only.test.ts — the F6 SECURITY guard (CLAUDE.md invariants 2,5,7,8).
//
// A static repo scan asserting the red-flag conditions can't be true:
//   • signing is server-only — NO client (apps/**) path imports the signer or
//     the private key; a learner can never mint/sign a credential.
//   • the Ed25519 PRIVATE key lives in Supabase Vault ONLY — it is never assigned
//     a value in a tracked file, and the Cloudflare Workers (which only SERVE
//     public data) never reference it or any signing function.
//   • the issuer's one signing location exists: the issue-badge Edge Function.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('repo root (pnpm-workspace.yaml) not found');
}

const ROOT = repoRoot();
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.turbo', 'coverage']);
const TEXT_EXT = /\.(ts|tsx|js|jsx|json|toml|md|yml|yaml)$|(^|\/)\.env(\.|$)/;

function walk(dir: string, exts: RegExp = TEXT_EXT): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full, exts));
    else if (exts.test(name) || /(^|\/)\.env/.test(name)) out.push(full);
  }
  return out;
}

/** Symbols that MINT/SIGN a credential or touch the private key — server-only. */
const SIGNING_SYMBOLS = [
  'signCredential',
  'signJsonLd',
  'signStatusListCredential',
  'loadSigningKey',
  'keyPairFromSecretMultibase',
  'OB_ISSUER_PRIVATE_KEY',
  'secretKeyMultibase',
];

describe('F6 security: signing is server-only; the private key is Vault-only', () => {
  it('no client (apps/**) bundle imports the signer or the private key', () => {
    const clientFiles = walk(join(ROOT, 'apps'), /\.(ts|tsx|js|jsx)$/);
    const offenders: string[] = [];
    for (const file of clientFiles) {
      if (/\.test\.(ts|tsx)$/.test(file)) continue;
      const src = readFileSync(file, 'utf8');
      for (const sym of SIGNING_SYMBOLS) {
        if (src.includes(sym)) offenders.push(`${file} → ${sym}`);
      }
    }
    // Clients may VERIFY a badge; they must NEVER sign one or see the key.
    expect(offenders).toEqual([]);
  });

  it('the Cloudflare Workers never hold the private key or a signing function', () => {
    const workerFiles = walk(join(ROOT, 'workers'), /\.(ts|toml)$/);
    expect(workerFiles.length).toBeGreaterThan(0); // sanity: the workers exist
    const offenders: string[] = [];
    for (const file of workerFiles) {
      const src = readFileSync(file, 'utf8');
      for (const sym of SIGNING_SYMBOLS) {
        if (src.includes(sym)) offenders.push(`${file} → ${sym}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no tracked file commits a REAL OB_ISSUER_PRIVATE_KEY value (Vault-only)', () => {
    // A real Ed25519 secretKeyMultibase is multibase base58btc ('z' + ≥40 base58
    // chars). Doc placeholders ("<new secretKeyMultibase>", "${kp.secretKeyMultibase}")
    // are fine; an actual committed key is the red flag. gitleaks is the broader net.
    const REAL_KEY = /z[1-9A-HJ-NP-Za-km-z]{40,}/;
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      const src = readFileSync(file, 'utf8');
      for (const line of src.split('\n')) {
        const m = /OB_ISSUER_PRIVATE_KEY\s*[=:]\s*(.*)$/.exec(line);
        if (m && REAL_KEY.test(m[1]!.replace(/#.*$/, ''))) {
          offenders.push(`${file} → "${line.trim()}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the one server signing location (issue-badge Edge Function) exists', () => {
    expect(existsSync(join(ROOT, 'supabase/functions/issue-badge/index.ts'))).toBe(true);
    expect(existsSync(join(ROOT, 'supabase/functions/issue-badge/handler.ts'))).toBe(true);
    // and it is a Deno function (Path A), co-located with the Vault key — not a Worker.
    const handler = readFileSync(join(ROOT, 'supabase/functions/issue-badge/handler.ts'), 'utf8');
    expect(handler).toContain("Deno.env.get('OB_ISSUER_PRIVATE_KEY')");
  });
});
