#!/usr/bin/env node
/**
 * verify-foundation.mjs — run this on `dev` BEFORE anyone opens a PR.
 *
 * Confirms every shared/frozen foundation file is present. If files are
 * missing, members "fix" them locally in their own branches — which is
 * exactly how you end up with four different versions of AuthContext.js
 * and repo-wide conflicts.
 *
 *   node scripts/verify-foundation.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, 'foundation-manifest.json'), 'utf8'));
const root = join(here, '..');

const missing = manifest.filter((f) => !existsSync(join(root, f)));

if (missing.length === 0) {
  console.log(`\x1b[32m✅ All ${manifest.length} foundation files present.\x1b[0m`);
  process.exit(0);
}

console.error(`\n\x1b[31m❌ ${missing.length} foundation file(s) MISSING from this branch:\x1b[0m\n`);
missing.forEach((f) => console.error(`   ${f}`));
console.error(`
Do NOT recreate these by hand — that is what caused the merge conflicts.
Restore them from the foundation bundle instead:

   git checkout origin/dev -- <path>          (if dev has them)
   or re-extract parkshare-foundation-push-first.zip over the repo root
`);
process.exit(1);
