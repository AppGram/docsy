import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { load } from 'js-yaml';

const managed = ['src', 'public', 'scripts', 'astro.config.mjs', 'tsconfig.json', 'Dockerfile', 'Dockerfile.bun', 'compose.yaml', 'LICENSE', '.github/workflows', '.gitignore', '.dockerignore'];
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const safePath = (path) => typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.includes('\\') && !/[\x00-\x1f]/.test(path) && !path.split('/').some((part) => ['', '.', '..', '.git'].includes(part));
const within = (root, path) => {
  if (!safePath(path)) throw new Error(`Unsafe project path: ${path}`);
  let current = root;
  for (const part of path.split('/')) {
    current = resolve(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error(`Refusing symlink: ${path}`);
  }
  if (existsSync(current) && relative(realpathSync(root), realpathSync(current)).startsWith('..')) throw new Error(`Path escapes project: ${path}`);
  return current;
};

export const templateFiles = (root) => {
  const files = {};
  const walk = (path) => {
    const absolute = within(root, path);
    if (!existsSync(absolute)) return;
    const stat = lstatSync(absolute);
    if (stat.isDirectory()) for (const name of readdirSync(absolute).sort()) walk(`${path}/${name}`);
    else if (stat.isFile()) files[path] = sha(absolute);
  };
  for (const path of managed) walk(path);
  return files;
};

export const writeTemplateManifest = (root, version, deployment = 'none') => {
  const file = within(root, '.docsy/template.json');
  mkdirSync(dirname(file), { recursive: true });
  const manifest = { schemaVersion: 1, generator: '@appgram/docsy', templateVersion: version, deployment, createdAt: new Date().toISOString(), files: templateFiles(root) };
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
};

const readManifest = (root) => {
  const file = within(root, '.docsy/template.json');
  if (!existsSync(file)) throw new Error('No template provenance found. See the upgrade guide for adopting older projects without guessing their baseline.');
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  if (manifest.schemaVersion !== 1 || manifest.generator !== '@appgram/docsy' || typeof manifest.templateVersion !== 'string' || !manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) throw new Error('Unsupported template manifest.');
  for (const [path, hash] of Object.entries(manifest.files)) {
    if (!safePath(path) || !managed.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) || !/^[a-f0-9]{64}$/.test(hash)) throw new Error(`Invalid template entry: ${path}`);
  }
  return manifest;
};

export const inspectUpgrade = (root, candidate) => {
  if (resolve(root) === resolve(candidate)) throw new Error('Compare against a separate freshly generated project, not the current project.');
  const baseline = readManifest(root); const next = readManifest(candidate);
  // A modified candidate is not a trustworthy upstream baseline.
  for (const [path, hash] of Object.entries(next.files)) if (!existsSync(within(candidate, path)) || sha(within(candidate, path)) !== hash) throw new Error(`Candidate was customized: ${path}. Generate a fresh project for comparison.`);
  const changes = [];
  for (const path of [...new Set([...Object.keys(baseline.files), ...Object.keys(next.files)])].sort()) {
    const file = within(root, path); const current = existsSync(file) ? sha(file) : null;
    const old = baseline.files[path] ?? null; const incoming = next.files[path] ?? null;
    if (current === incoming) continue;
    const status = incoming === old ? 'preserve-local' : current !== old ? 'conflict' : incoming === null ? 'review-removal' : 'upstream-change';
    changes.push({ path, status, baseline: old, current, incoming });
  }
  const report = { schemaVersion: 1, from: baseline.templateVersion, to: next.templateVersion, applied: false, changes };
  const key = createHash('sha256').update(JSON.stringify(report)).digest('hex').slice(0, 12);
  const output = within(root, `.docsy/upgrades/${key}/report.json`);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Docsy ${report.from} → ${report.to}: ${changes.length} differences; ${changes.filter((item) => item.status === 'conflict').length} conflicts. No project files were changed.\nReview: ${output}\nCompare each upstream-change/conflict with the fresh project. Preserve YAML, content, customizations and dependency changes; validate and build before committing.`);
  return report;
};

export const doctor = (root) => {
  const results = [];
  const add = (check, ok, detail) => results.push({ check, ok, detail });
  const [major, minor] = process.versions.node.split('.').map(Number);
  add('Node', major > 22 || major === 22 && minor >= 22, `Node ${process.versions.node}; requires 22.22+`);
  add('Dependencies', existsSync(resolve(root, 'node_modules/astro')), 'Run npm install if dependencies are missing.');
  const file = process.env.DOCSY_CONFIG || 'docsy.config.yaml';
  add('Configuration', existsSync(resolve(root, file)), file);
  if (existsSync(resolve(root, file))) {
    try {
      const config = load(readFileSync(resolve(root, file), 'utf8'));
      const server = config?.access?.mode === 'locked' || config?.agent?.query === true;
      const deployment = existsSync(resolve(root, '.docsy/template.json')) ? readManifest(root).deployment : 'none';
      add('Deployment compatibility', deployment !== 'github-pages' || !server, server ? 'Runtime features require Node/Bun; never deploy restricted docs to a static host.' : 'Static output; GitHub Pages is compatible.');
      console.log(`Local preview: http://localhost:4321${config?.site?.basePath || '/'}/`.replace(/\/{2}$/, '/'));
      if (deployment === 'github-pages') console.log('Publish when ready: enable Pages (GitHub Actions), set repository variable DOCSY_ENABLE_PAGES=true, then run Deploy documentation. Nothing is deployed by this command.');
    } catch (error) { add('Readable YAML/provenance', false, error.message); }
  }
  for (const result of results) console.log(`${result.ok ? '✓' : '✗'} ${result.check}: ${result.detail}`);
  console.log('Next: npm run validate → npm run build → npm run preview.');
  return results.every((result) => result.ok);
};
