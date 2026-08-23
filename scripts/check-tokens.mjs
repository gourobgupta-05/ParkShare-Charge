#!/usr/bin/env node
/**
 * 🔒 DESIGN TOKEN LINTER — run by every PR (npm run check:tokens).
 * Fails if a feature file hardcodes a colour instead of using a named token.
 * Four people picking four different greens is exactly what this prevents.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path, { join, extname } from 'node:path';

const ROOTS = ['frontend/src/features', 'frontend/src/app', 'frontend/src/components'];
const ALLOWLIST = ['frontend/src/app/globals.css', 'frontend/src/lib/constants.js'];
const EXTS = new Set(['.js', '.jsx', '.css']);

const RULES = [
  { name: 'raw hex colour', re: /#[0-9a-fA-F]{3,8}\b/g },
  { name: 'arbitrary colour class', re: /(bg|text|border|ring|fill|stroke)-\[#?[0-9a-zA-Z(),.%\s/-]+\]/g },
  {
    name: 'default Tailwind palette',
    re: /\b(bg|text|border|ring|from|to|via)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
  },
  { name: 'dark mode variant (light-only project)', re: /\bdark:[a-z-]+/g },
];

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTS.has(extname(full))) out.push(full);
  }
  return out;
}

const violations = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const rel = file.split(path.sep).join('/');
    if (ALLOWLIST.some((a) => rel.endsWith(a))) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.includes('token-lint-ignore')) return;
      for (const rule of RULES) {
        const hits = line.match(rule.re);
        if (hits) violations.push({ file, line: i + 1, rule: rule.name, text: hits.join(', ') });
      }
    });
  }
}

if (violations.length) {
  console.error('\n❌ Design token violations — use named tokens from tailwind.config.js:\n');
  for (const v of violations) {
    console.error(`   ${v.file}:${v.line}  [${v.rule}]  → ${v.text}`);
  }
  console.error('\n   Allowed: bg-surface, text-ink, border-line, bg-brand-primary, bg-warning-subtle …');
  console.error('   See docs/04-design-system.md\n');
  process.exit(1);
}

console.log('✅ No design token violations.');
