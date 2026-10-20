import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

export const confirmation = (pkg) => `${pkg.name}@${pkg.version}`;
export function releaseManifest(root) {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
  assert.equal(pkg.name, '@appgram/docsy', 'Unexpected release package');
  assert.equal(pkg.private, false, 'The release candidate must be public-ready');
  assert.match(pkg.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*)?$/, 'Invalid release version');
  assert.ok(!pkg.version.includes('internal'), 'Do not publish an internal build');
  assert.equal(lock.version, pkg.version, 'Lockfile version differs');
  assert.equal(lock.packages[''].version, pkg.version, 'Root lockfile version differs');
  assert.equal(pkg.publishConfig.access, 'public');
  assert.equal(pkg.publishConfig.registry, 'https://registry.npmjs.org/');
  assert.equal(pkg.repository.url, 'git+https://github.com/AppGram/docsy.git');
  assert.equal(pkg.license, 'Elastic-2.0');
  assert.deepEqual(pkg.bin, { docsy: 'scripts/docsy.mjs', 'create-docsy': 'scripts/create-docsy.mjs' });
  return pkg;
}
export function auditPackageFiles(files) {
  const paths = new Set(files.map((file) => file.path));
  const required = ['package.json', 'LICENSE', 'README.md', 'astro.config.mjs', 'tsconfig.json', 'Dockerfile', 'Dockerfile.bun', '.dockerignore', '.github/workflows/docsy-maintenance.yml', 'scripts/docsy.mjs', 'scripts/create-docsy.mjs', 'scripts/scaffold/gitignore', 'scripts/scaffold/index.astro', 'scripts/scaffold/format-md.ts', 'scripts/scaffold/workflows.mjs', 'scripts/start.mjs', 'scripts/lib/http-range.mjs', 'scripts/validate-content.ts', 'src/config.ts', 'src/components/docs/AuthorBadge.astro', 'public/assets/authors/unknown.svg', 'content/reference/upgrading.md'];
  for (const path of required) assert.ok(paths.has(path), `Missing packaged template file: ${path}`);
  for (const path of ['scripts/release/package.mjs', 'scripts/release/prepublish.mjs', 'scripts/release/publish.mjs', 'scripts/pack-package.mjs']) assert.ok(paths.has(path), `Missing packaged release tool: ${path}`);
  for (const path of paths) {
    assert.ok(!path.startsWith('/') && !path.split('/').includes('..') && !path.includes('\\'), `Unsafe package path: ${path}`);
    assert.ok(!/(^|\/)(?:\.env(?:\.|$)|\.npmrc$|id_rsa(?:\.|$)|id_ed25519(?:\.|$))/.test(path), `Sensitive file in package: ${path}`);
    assert.ok(!/^(?:node_modules|dist|release|tests|\.git|\.docsy)\//.test(path), `Unnecessary build/test output in package: ${path}`);
    assert.ok(!path.startsWith('docs/assets/launch/'), 'Launch media must not inflate the npm package');
    assert.notEqual(path, 'docs/npm-release.md', 'Internal release runbooks must not be packaged');
  }
}
export const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
export function packPackage(root, destination) {
  const pkg = releaseManifest(root);
  const output = resolve(destination); mkdirSync(output, { recursive: true });
  const [packed] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--cache', resolve(output, '.npm-cache'), '--pack-destination', output], { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }));
  auditPackageFiles(packed.files);
  const filename = `${pkg.name.replace(/^@/, '').replace('/', '-')}-${pkg.version}.tgz`;
  assert.equal(packed.filename, filename); assert.equal(basename(packed.filename), packed.filename);
  assert.ok(packed.size < 10 * 1024 * 1024, 'Review an unexpectedly large npm package');
  const artifact = { name: pkg.name, version: pkg.version, filename, sha256: sha256(resolve(output, filename)), integrity: packed.integrity, packedBytes: packed.size, unpackedBytes: packed.unpackedSize, files: packed.entryCount };
  writeFileSync(resolve(output, 'package-manifest.json'), JSON.stringify(artifact, null, 2) + '\n');
  return artifact;
}
export function assertPublishConfirmation(pkg, env = process.env) {
  assert.equal(env.DOCSY_CONFIRM_NPM_PUBLISH, confirmation(pkg), `Publication requires explicit confirmation: DOCSY_CONFIRM_NPM_PUBLISH=${confirmation(pkg)}`);
}
export function assertWorkflowPublish(pkg, env = process.env) {
  assertPublishConfirmation(pkg, env);
  assert.equal(env.DOCSY_ENABLE_NPM_PUBLISH, 'true', 'npm publishing remains disabled by the repository gate');
  assert.equal(env.DOCSY_RELEASE_REQUESTED, 'true', 'Select the explicit publish action');
  assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch');
  assert.equal(env.GITHUB_REPOSITORY, 'AppGram/docsy');
  assert.equal(env.GITHUB_REF, 'refs/heads/main');
  assert.ok(['latest', 'next', 'beta'].includes(env.DOCSY_NPM_TAG), 'Invalid npm dist-tag');
  assert.ok(!pkg.version.includes('-') || env.DOCSY_NPM_TAG !== 'latest', 'A prerelease cannot use the latest tag');
  assert.ok(!env.NODE_AUTH_TOKEN && !env.NPM_TOKEN, 'Use the npm trusted publisher, not a persistent npm token');
}
