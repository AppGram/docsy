import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { load } from 'js-yaml';
import { inspectUpgrade, writeTemplateManifest } from '../scripts/project-tools.mjs';

const temporary = [];
const temp = () => { const root = mkdtempSync(join(tmpdir(), 'docsy-adoption-')); temporary.push(root); return root; };
afterEach(() => { for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true }); });
const write = (root, path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
const read = (root, path) => readFileSync(join(root, path), 'utf8');

test('scaffold records version provenance and optional gated workflows without publishing', () => {
  const root = join(temp(), 'docs');
  const output = execFileSync(process.execPath, ['scripts/create-docsy.mjs', root, '--yes', '--no-install', '--ci', '--deploy', 'github-pages', '--repo', 'https://github.com/example/handbook'], { encoding: 'utf8' });
  const config = load(read(root, 'docsy.config.yaml'));
  assert.equal(config.site.basePath, '/handbook');
  assert.equal(config.site.homeUrl, '/handbook/');
  assert.equal(config.site.origin, 'https://example.github.io');
  assert.equal(config.site.name, 'Docs');
  assert.equal(config.reader.editUrl, 'https://github.com/example/handbook/edit/main/{source}');
  assert.equal(config.reader.editPlacement, 'footer');
  assert.equal(config.reader.editStyle, 'subtle');
  assert.match(read(root, '.github/workflows/pages.yml'), /DOCSY_ENABLE_PAGES == 'true'/);
  assert.match(read(root, '.github/workflows/docsy-checks.yml'), /docsy-static-preview/);
  assert.equal(JSON.parse(read(root, '.docsy/template.json')).templateVersion, JSON.parse(readFileSync('package.json', 'utf8')).version);
  assert.ok(existsSync(join(root, 'UPGRADING.md')));
  assert.match(read(root, 'DEPLOYING.md'), /https:\/\/example.github.io\/handbook\//);
  assert.match(read(root, 'DEPLOYING.md'), /Explicit publishing decision/);
  assert.match(output, /Nothing has been deployed/);
  const version = execFileSync(process.execPath, [join(root, 'scripts/docsy.mjs'), '--version'], { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(version, JSON.parse(readFileSync('package.json', 'utf8')).version);
});

test('Pages scaffold rejects locked sites and invalid repository URLs before creating a project', () => {
  const root = join(temp(), 'docs');
  assert.throws(() => execFileSync(process.execPath, ['scripts/create-docsy.mjs', root, '--yes', '--no-install', '--locked', '--deploy', 'github-pages', '--repo', 'https://github.com/example/docs'], { stdio: 'pipe' }));
  assert.ok(!existsSync(root));
  assert.throws(() => execFileSync(process.execPath, ['scripts/create-docsy.mjs', root, '--yes', '--no-install', '--repo', 'javascript:alert(1)'], { stdio: 'pipe' }));
});

test('upgrade comparison reports changes and preserves local edits without overwrites', () => {
  const root = temp(); const candidate = temp();
  for (const site of [root, candidate]) { write(site, 'src/a.ts', 'old\n'); write(site, 'src/b.ts', 'old\n'); }
  writeTemplateManifest(root, '0.3.0');
  write(root, 'src/a.ts', 'my customization\n');
  write(candidate, 'src/a.ts', 'upstream fix\n'); write(candidate, 'src/b.ts', 'upstream fix\n');
  writeTemplateManifest(candidate, '0.4.0-internal.0');
  const result = inspectUpgrade(root, candidate);
  assert.equal(result.applied, false);
  assert.equal(result.changes.find((item) => item.path === 'src/a.ts').status, 'conflict');
  assert.equal(result.changes.find((item) => item.path === 'src/b.ts').status, 'upstream-change');
  assert.equal(read(root, 'src/a.ts'), 'my customization\n');
  assert.equal(read(root, 'src/b.ts'), 'old\n');
  write(candidate, 'src/a.ts', 'modified candidate\n');
  assert.throws(() => inspectUpgrade(root, candidate), /Candidate was customized/);
});

test('provenance refuses symlinks and unknown upgrade baselines', () => {
  const root = temp(); const outside = temp(); write(outside, 'secret', 'not managed');
  mkdirSync(join(root, 'src')); symlinkSync(join(outside, 'secret'), join(root, 'src/alias'));
  assert.throws(() => writeTemplateManifest(root, '0.4.0-internal.0'), /symlink/);
  assert.throws(() => inspectUpgrade(temp(), temp()), /No template provenance/);
});

test('the public release candidate keeps publication explicit and generated projects private', () => {
  const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
  assert.equal(pkg.private, false);
  assert.equal(pkg.publishConfig.access, 'public');
  assert.equal(pkg.scripts.prepublishOnly, 'node scripts/release/prepublish.mjs');
  assert.ok(!pkg.version.includes('internal'));
});
test('a generated site can generate another site without losing its template version', () => {
  const first = join(temp(), 'first'); const second = join(temp(), 'second');
  execFileSync(process.execPath, ['scripts/create-docsy.mjs', first, '--yes', '--no-install'], { stdio: 'pipe' });
  // CLI dependencies are resolved by the copied scripts, just as after install.
  symlinkSync(resolve('node_modules'), join(first, 'node_modules'), 'dir');
  execFileSync(process.execPath, ['scripts/docsy.mjs', 'create', second, '--yes', '--no-install'], { cwd: first, stdio: 'pipe' });
  assert.equal(JSON.parse(read(second, '.docsy/template.json')).templateVersion, JSON.parse(readFileSync('package.json', 'utf8')).version);
  assert.ok(existsSync(join(second, '.gitignore')));
  assert.ok(existsSync(join(second, 'UPGRADING.md')));
});
