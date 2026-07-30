#!/usr/bin/env node
/**
 * copy-integrity — the rebrand guardrail.
 *
 * The Kept. rebrand rule: a rebrand change may only touch styles, tokens,
 * brand components, and the company name. Human COPY must stay word-for-word.
 * This script turns that rule into a machine check.
 *
 * For every changed apps/web/**.{tsx,ts} file between a base ref and the
 * working tree, it extracts the *static visible text* (JSX text nodes, minus
 * tags, attributes, className/style, and {expressions}), normalises it, strips
 * the allow-listed name swap, and diffs before vs after. Any residual change in
 * visible prose fails the check.
 *
 *   node scripts/copy-integrity.mjs [baseRef]
 *
 * baseRef defaults to the fork point of this branch (merge-base with the
 * upstream tracking branch, else HEAD~1).
 *
 * SCOPE / HONESTY: this checks STATIC copy only. Text produced inside
 * {expressions} (dynamic copy) is intentionally not compared — extracting it
 * reliably needs a rendered snapshot (a running app + DB). Treat a clean pass
 * as "no static prose changed", not "every pixel of copy is proven identical".
 * For dynamic-heavy pages, pair this with a visual diff of the preview deploy.
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Name variants that ARE allowed to change (the one legitimate content edit).
// Order longest-first so specific forms are stripped before general ones.
const NAME_ALLOWLIST = [
  /bellwood lane ventures(?: ltd)?/gi,
  /bellwoods lane ventures/gi,
  /bellwoods? lane ltd/gi,
  /bellwoods lane/gi,
  /bellwood ventures/gi,
  /bellwood score/gi,
  /bellwoods?(?:['’]s)?/gi,
  /kept score/gi,
  /kept(?:['’]s)?\.?/gi,
];

function sh(cmd) {
  return execSync(cmd, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function resolveBase(arg) {
  if (arg) return arg;
  try {
    const upstream = sh('git rev-parse --abbrev-ref --symbolic-full-name @{u}');
    return sh(`git merge-base HEAD ${upstream}`);
  } catch {
    return 'HEAD~1';
  }
}

/**
 * Extract static JSX text nodes — the visible copy. We deliberately do NOT try
 * to balance <> (TSX overloads them with generics, comparisons and => arrows,
 * which makes any brace/angle counting unreliable). Instead we capture runs of
 * text that sit between a `>` and a `<` and contain no tag/brace characters —
 * i.e. pure text nodes like `>Show the raw link<`. Nodes that interleave with
 * {expressions} (dynamic copy) are skipped; that is the documented blind spot.
 */
function visibleText(src) {
  let s = src;
  s = s.replace(/\/\*[\s\S]*?\*\//g, ' '); // block comments (incl. license/jsx comments)
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  // JSX whitespace spacers are formatting, not copy: Biome freely moves
  // `{' '}` between line ends when re-wrapping, which would otherwise shift
  // text in/out of our static captures and raise false alarms.
  s = s.replace(/\{\s*['"`] ['"`]\s*\}/g, ' ');

  const texts = [];
  const re = />([^<>{}]*?[A-Za-z][^<>{}]*?)</g;
  let m;
  while ((m = re.exec(s)) !== null) {
    let t = m[1];
    t = t
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&[a-z]+;/gi, ' ');
    // ignore captures that are obviously code, not prose (e.g. `=> (`), by
    // requiring at least one alphabetic word run
    if (/[A-Za-z]{2,}/.test(t)) texts.push(t);
  }
  // Compare a punctuation-stripped word stream: formatter re-wraps shuffle
  // brackets/space-adjacent punctuation without touching prose, so only word
  // tokens are load-bearing. (Trade-off, documented: a punctuation-only copy
  // change — e.g. "." -> "!" — is not caught.)
  return texts
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9£%&''\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripNames(text) {
  let t = text;
  for (const re of NAME_ALLOWLIST) t = t.replace(re, '§');
  return t
    .replace(/§[\s§]*/g, '§ ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordDiff(a, b) {
  const aw = a.split(' ');
  const bw = b.split(' ');
  const setB = new Set(bw);
  const setA = new Set(aw);
  const removed = aw.filter((w) => w && !setB.has(w));
  const added = bw.filter((w) => w && !setA.has(w));
  return { removed: [...new Set(removed)], added: [...new Set(added)] };
}

const base = resolveBase(process.argv[2]);
const repoRoot = sh('git rev-parse --show-toplevel');
let changed = [];
try {
  changed = sh(`git diff --name-only ${base} -- apps/web`)
    .split('\n')
    .filter(
      (f) =>
        /\.(tsx?|jsx?)$/.test(f) &&
        !f.endsWith('.d.ts') &&
        // The brand component layer is explicitly allowed to change — this
        // guard protects PAGE copy, not the intentional brand rewrite.
        !f.includes('apps/web/components/brand/')
    );
} catch (e) {
  console.error(`copy-integrity: cannot diff against ${base}: ${e.message}`);
  process.exit(2);
}

if (changed.length === 0) {
  console.log(
    `copy-integrity: no changed apps/web source files vs ${base.slice(0, 12)}. OK.`
  );
  process.exit(0);
}

const violations = [];
for (const file of changed) {
  let before = '';
  try {
    before = sh(`git show ${base}:${file}`);
  } catch {
    continue; // new file — no prior copy to preserve
  }
  let after = '';
  try {
    after = readFileSync(join(repoRoot, file), 'utf8');
  } catch {
    continue; // deleted
  }
  const a = stripNames(visibleText(before));
  const b = stripNames(visibleText(after));
  if (a !== b) violations.push({ file, ...wordDiff(a, b) });
}

if (violations.length === 0) {
  console.log(
    `copy-integrity: ${changed.length} changed file(s) vs ${base.slice(0, 12)} — ` +
      `static visible copy unchanged (aside from the allow-listed name swap). OK.`
  );
  process.exit(0);
}

console.error(
  `\ncopy-integrity: FAILED — static copy changed in ${violations.length} file(s):\n`
);
for (const v of violations) {
  console.error(`  ${v.file}`);
  if (v.removed.length) console.error(`    − ${v.removed.join(' ')}`);
  if (v.added.length) console.error(`    + ${v.added.join(' ')}`);
}
console.error(
  `\nA rebrand change may only alter styles/tokens/brand/name — not copy.\n` +
    `If a change above is legitimate (e.g. a new allow-listed name form), update\n` +
    `NAME_ALLOWLIST in scripts/copy-integrity.mjs; otherwise revert the wording.\n`
);
process.exit(1);
