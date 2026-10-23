import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { z } from 'zod';
import { maintenanceSchema } from '../scripts/maintenance/config.mjs';

const require = createRequire(import.meta.url);
const patched = (version) => {
  const [major, minor, patch] = version.split('.').map(Number);
  return major > 4 || (major === 4 && (minor > 6 || (minor === 6 && patch >= 6)));
};

test('the installed and locked Zod versions include the oversized-collection security patch', () => {
  assert.ok(patched(require('zod/package.json').version));
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const copies = Object.entries(lock.packages).filter(([path]) => /(?:^|\/)node_modules\/zod$/.test(path));
  assert.ok(copies.length > 0);
  for (const [path, pkg] of copies) assert.ok(patched(pkg.version), `${path}: ${pkg.version}`);
});

test('oversized arrays, maps and sets fail before any element validation', () => {
  let visited = 0;
  const item = z.unknown().transform(() => { visited++; return true; });
  const values = Array.from({ length: 20_000 }, (_, i) => i);
  for (const [schema, input] of [
    [z.array(item).max(2), values],
    [z.array(item).length(2), values],
    [z.map(item, item).max(2), new Map(values.map(i => [i, i]))],
    [z.set(item).max(2), new Set(values)],
  ]) {
    const result = schema.safeParse(input);
    assert.equal(result.success, false);
    assert.equal(result.error.issues.length, 1);
    assert.equal(result.error.issues[0].code, 'too_big');
    assert.equal(visited, 0, 'Length limits must run before parsing collection contents');
  }
});

test('Zod 4 preserves maintenance defaults and bounds configured example checks', () => {
  const defaults = maintenanceSchema.parse(undefined);
  assert.equal(defaults.enabled, false);
  assert.deepEqual(defaults.watch, ['sources/**', 'src/**']);
  assert.deepEqual(defaults.docs, ['content/**/*.md', 'README.md']);
  assert.equal(defaults.maxDiffChars, 60_000);
  assert.deepEqual(defaults.exampleChecks, []);
  assert.equal(maintenanceSchema.parse({ exampleChecks: [{ name: 'Run tests', command: ['node', 'test.mjs'] }] }).exampleChecks[0].timeoutMs, 30_000);
  const result = maintenanceSchema.safeParse({ exampleChecks: Array(20_000).fill(null) });
  assert.equal(result.success, false);
  assert.deepEqual(result.error.issues.map(({ code, path }) => ({ code, path })), [{ code: 'too_big', path: ['exampleChecks'] }]);
});
