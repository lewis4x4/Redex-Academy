#!/usr/bin/env tsx
/**
 * fixture:gate — sanitized-fixture publish gate: a published sim may not
 * reference an unsanitized fixture (`fixture_sets.sanitized = true` is required).
 * CLAUDE.md invariant §6; SAFETY_GLOSSARY.md "fixture (sanitized)".
 *
 * F1: stub no-op (no fixtures/sim specs exist yet). F5 makes this real and
 * merge-blocking once the sim framework + fixture model land.
 */
import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function hasSimExamples(): boolean {
  const examples = resolve(repoRoot, 'sim-contracts/examples');
  try {
    return existsSync(examples) && readdirSync(examples).length > 0;
  } catch {
    return false;
  }
}

if (!hasSimExamples()) {
  console.log(
    '[fixture:gate] No published sim specs/fixtures wired yet (pre-F5). Publish gate is a no-op.',
  );
  process.exit(0);
}

console.log(
  '[fixture:gate] Sim-contract examples present (authored). The enforcing publish-gate check ' +
    'is wired in F5 once fixtures resolve to fixture_sets.sanitized — no-op until then.',
);
process.exit(0);
