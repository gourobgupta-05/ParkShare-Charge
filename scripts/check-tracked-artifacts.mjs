#!/usr/bin/env node
/**
 * check-tracked-artifacts.mjs — the guard that stops this happening again.
 *
 * Fails if Git is tracking build output, dependencies or secrets. Wire it into
 * `npm run predev` / `prebuild` and a pre-push hook so a 16,000-line diff can
 * never reach a PR again.
 *
 *   node scripts/check-tracked-artifacts.mjs
 */
import { execSync } from 'node:child_process';

const FORBIDDEN = [
  { label: 'Next.js build output', re: /(^|\/)\.next\// },
  { label: 'dependencies',         re: /(^|\/)node_modules\// },
  { label: 'build output',         re: /(^|\/)(dist|out|build)\// },
  { label: 'environment secrets',  re: /(^|\/)\.env$|(^|\/)\.env\.local$|(^|\/)\.env\.(development|production|test)/ },
  { label: 'log files',            re: /\.log$/ },
  { label: 'uploaded files',       re: /(^|\/)uploads\/(?!\.gitkeep)/ },
];

let tracked;
try {
  tracked = execSync('git ls-files', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
} catch {
  console.error('Not a git repository — skipping artifact check.');
  process.exit(0);
}

const hits = [];
for (const file of tracked) {
  for (const { label, re } of FORBIDDEN) {
    if (re.test(file)) { hits.push({ file, label }); break; }
  }
}

if (hits.length === 0) {
  console.log(`\x1b[32m✅ No build artifacts or secrets tracked (${tracked.length} files checked).\x1b[0m`);
  process.exit(0);
}

const byLabel = {};
for (const h of hits) (byLabel[h.label] ||= []).push(h.file);

console.error(`\n\x1b[31m❌ ${hits.length} file(s) that must NEVER be committed are tracked:\x1b[0m\n`);
for (const [label, files] of Object.entries(byLabel)) {
  console.error(`  ${label} — ${files.length} file(s)`);
  files.slice(0, 5).forEach((f) => console.error(`     ${f}`));
  if (files.length > 5) console.error(`     …and ${files.length - 5} more`);
}
console.error(`
Fix (keeps your local files, only stops Git tracking them):

   git rm -r --cached frontend/.next node_modules --ignore-unmatch
   git commit -m "chore: stop tracking build artifacts"
`);
process.exit(1);
