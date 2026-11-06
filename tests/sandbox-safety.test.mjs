import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Hosted docs are served CSP-sandboxed (opaque origin), where touching
// localStorage/sessionStorage throws. Every access must sit inside a try.
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : /\.(astro|ts|mjs|js)$/.test(name) ? [path] : [];
});

test('storage access in shipped UI code is guarded for sandboxed pages', () => {
  const unguarded = [];
  for (const file of [...walk('src'), ...walk('scripts/scaffold')]) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!/\b(localStorage|sessionStorage)\b/.test(line)) return;
      const previous = lines.slice(Math.max(0, i - 2), i + 1).join('\n');
      if (!/\btry\b/.test(previous)) unguarded.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(unguarded, []);
});

test('layout copy buttons fall back when the Clipboard API is refused', () => {
  const layout = readFileSync('src/layouts/DocsLayout.astro', 'utf8');
  assert.match(layout, /docsyCopyText = \(text\) => copySectionLink\(text\)/);
  assert.equal((layout.match(/navigator\.clipboard\.writeText/g) || []).length, 1);
});
