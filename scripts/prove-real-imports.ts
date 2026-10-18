// Private, reproducible stress test. Generators consume actual installed libraries,
// not hand-authored normalized JSON. Outputs stay ignored under .docsy/.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { loadNativeSdk } from '../src/lib/native-sdk';
import type { SdkSourceConfig } from '../src/config';
import { dump, load } from 'js-yaml';

const root = process.cwd();
const output = resolve(root, '.docsy/real-projects');
mkdirSync(output, { recursive: true });
const digest = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const fileHashes = (directory: string): { path: string; sha256: string }[] => readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  return entry.isDirectory() ? fileHashes(path) : entry.isFile() ? [{ path: relative(output, path), sha256: digest(readFileSync(path)) }] : [];
});
const projects = [
  { name: 'zod', entry: 'src/v3/index.ts', adapter: 'typedoc', language: 'typescript', minimum: 500, symbol: /ZodObject/ },
  { name: 'yaml', entry: 'dist/index.d.ts', adapter: 'typedoc', language: 'typescript', minimum: 50, symbol: /parseDocument/ },
  { name: 'lodash', entry: 'lodash.js', adapter: 'jsdoc', language: 'javascript', minimum: 200, symbol: /chunk/ },
] as const;
const results = [];
for (const project of projects) {
  const source = resolve(root, 'node_modules', project.name);
  const pkg = JSON.parse(readFileSync(resolve(source, 'package.json'), 'utf8'));
  const input = resolve(output, 'inputs', `${project.name}-${pkg.version}`);
  cpSync(source, input, { recursive: true, filter: (path) => !path.includes('/node_modules/', source.length) });
  const artifact = resolve(output, `${project.name}.json`);
  let generator: string; let args: string[];
  if (project.adapter === 'typedoc') {
    const tsconfig = resolve(output, `${project.name}.tsconfig.json`);
    writeFileSync(tsconfig, JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', skipLibCheck: true, strict: true }, include: [resolve(input, project.entry)] }));
    generator = 'typedoc';
    args = [resolve(root, 'node_modules/typedoc/bin/typedoc'), resolve(input, project.entry), '--tsconfig', tsconfig, '--json', artifact, '--skipErrorChecking', '--logLevel', 'Error'];
    execFileSync(process.execPath, args, { cwd: output, stdio: 'inherit', timeout: 120_000 });
  } else {
    generator = 'jsdoc';
    args = [resolve(root, 'node_modules/jsdoc/jsdoc.js'), '-X', resolve(input, project.entry)];
    writeFileSync(artifact, execFileSync(process.execPath, args, { cwd: output, maxBuffer: 50 * 1024 * 1024, timeout: 120_000 }));
  }
  const config = { id: project.name, slug: project.name, adapter: project.adapter, source: artifact, language: project.language, maxFileBytes: 50 * 1024 * 1024, maxTotalBytes: 100 * 1024 * 1024 } as SdkSourceConfig;
  const doc = loadNativeSdk(config, { name: project.name, language: project.language, install: `npm install ${project.name}@${pkg.version}`, overview: 'Real-library compatibility test, not a complete compatibility guarantee.' });
  const items = doc.categories.flatMap((category) => category.items);
  assert.ok(items.length >= project.minimum, `${project.name}: only ${items.length} symbols`);
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  assert.ok(items.some((item) => project.symbol.test(item.name)));
  assert.ok(items.some((item) => item.parameters?.length));
  assert.ok(items.some((item) => item.declaration));
  if (project.name === 'lodash') assert.ok(items.filter((item) => item.example).length >= 100);
  const generatorPkg = JSON.parse(readFileSync(resolve(root, 'node_modules', generator, 'package.json'), 'utf8'));
  results.push({ name: project.name, version: pkg.version, repository: pkg.repository, license: pkg.license, adapter: project.adapter, generator: `${generator}@${generatorPkg.version}`, errorChecking: project.adapter === 'typedoc' ? 'TypeDoc skipErrorChecking; parser/import test, not library type-check certification' : 'JSDoc parser', command: ['node', ...args.map((arg) => arg.startsWith(root) ? relative(root, arg) : arg)], input: fileHashes(input), output: { path: relative(root, artifact), sha256: digest(readFileSync(artifact)) }, symbols: items.length, examples: items.filter((item) => item.example).length, typedParameters: items.filter((item) => item.parameters?.length).length, categories: doc.categories.length });
  console.log(`${project.name}@${pkg.version}: ${items.length} symbols; ${results.at(-1)!.examples} examples`);
}
const result = { schemaVersion: 1, published: false, node: process.version, limitations: ['Three JavaScript/TypeScript libraries, not twenty-language production certification.', 'Examples are imported, not all executed.', 'Native declarations and comments are preserved only where the generator exposes them.'], projects: results };
if (process.argv.includes('--render')) {
  const site = resolve(output, 'rendered-site');
  // Reuse only this script's own project, never reset or overwrite a caller's site.
  if (!existsSync(site)) execFileSync(process.execPath, ['scripts/create-docsy.mjs', site, '--yes', '--no-install', '--name', 'Real library import proof'], { cwd: root, stdio: 'pipe' });
  if (!existsSync(resolve(site, 'node_modules'))) symlinkSync(resolve(root, 'node_modules'), resolve(site, 'node_modules'), 'dir');
  const config = load(readFileSync(resolve(site, 'docsy.config.yaml'), 'utf8')) as any;
  config.ingestion.openapi.enabled = false;
  config.ingestion.sdks = projects.map((project) => {
    cpSync(resolve(output, `${project.name}.json`), resolve(site, 'sources', `${project.name}.json`));
    return { id: project.name, slug: `${project.name}-sdk`, source: `sources/${project.name}.json`, adapter: project.adapter, language: project.language, name: project.name, install: `npm install ${project.name}`, overview: 'Native generator output compatibility test.', maxFileBytes: 50 * 1024 * 1024 };
  });
  config.navigation = [{ title: 'Real libraries', items: projects.map((project) => ({ title: project.name, href: `/${project.name}-sdk` })) }];
  writeFileSync(resolve(site, 'docsy.config.yaml'), dump(config));
  const log = execFileSync(process.execPath, ['scripts/docsy.mjs', 'build'], { cwd: site, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 180_000 });
  writeFileSync(resolve(output, 'render-build.log'), log);
  const pages = projects.map((project) => {
    const path = resolve(site, 'release/docs', `${project.name}-sdk/index.html`);
    const html = readFileSync(path, 'utf8'); assert.match(html, project.symbol);
    return { path: relative(root, path), bytes: Buffer.byteLength(html), sha256: digest(html) };
  });
  Object.assign(result, { render: { buildPassed: true, checkedLinksAndAnchors: true, pages } });
  console.log('All three real-library references rendered; built-site links and anchors checked.');
}
writeFileSync(resolve(output, 'report.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(`Private proof: ${resolve(output, 'report.json')}`);
