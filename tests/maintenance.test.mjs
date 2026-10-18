import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { dump, load } from 'js-yaml';
import { maintenanceSchema, matchesGlob } from '../scripts/maintenance/config.mjs';
import { compareOpenApi, findDocImpact } from '../scripts/maintenance/impact.mjs';
import { guardChanges, maintenancePrompt, planMaintenance, runExampleChecks, runMaintenance, verifyMaintenance } from '../scripts/maintenance.mjs';
import { publishPullRequest } from '../scripts/maintenance/publish.mjs';

const temporary = [];
const temp = () => { const path = mkdtempSync(join(tmpdir(), 'docsy-maintenance-test-')); temporary.push(path); return path; };
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }); });
const write = (root, path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
const read = (root, path) => readFileSync(join(root, path), 'utf8');
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const commit = (root) => { git(root, 'add', '.'); git(root, 'commit', '-m', 'fixture'); return git(root, 'rev-parse', 'HEAD'); };

const spec = () => ({
  openapi: '3.0.3', info: { title: 'Widget API', version: '1.0' },
  components: { schemas: { Widget: { type: 'object', properties: { id: { type: 'string' } } } } },
  paths: {
    '/widgets': { get: { operationId: 'listWidgets', responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Widget' } } } } } } },
    '/legacy': { get: { summary: 'Legacy route', responses: { 200: { description: 'OK' } } } },
  },
});

const fixture = () => {
  const root = temp();
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.name', 'Docsy Test');
  git(root, 'config', 'user.email', 'docsy@example.test');
  write(root, '.gitignore', '.docsy/maintenance/\nnode_modules/\ndist/\nrelease/\n');
  write(root, 'docsy.config.yaml', dump({
    site: { name: 'Widgets', origin: 'https://example.test' },
    maintenance: { enabled: true, watch: ['sources/**', 'src/**'], docs: ['content/**/*.md', 'README.md'] },
    content: { articles: [{ slug: 'widgets', source: 'content/widgets.md', title: 'Widgets' }] },
    navigation: [{ title: 'Guides', items: [{ title: 'Widgets', href: '/guides/widgets' }] }],
    access: { mode: 'locked', tiers: { enterprise: { label: 'Enterprise' } } },
    ingestion: { sdks: [], openapi: { enabled: true, source: 'sources/openapi.json', sections: [] } },
  }));
  write(root, 'sources/openapi.json', JSON.stringify(spec()));
  write(root, 'src/client.ts', 'export function listWidgets() { return fetch("/widgets"); }\n');
  write(root, 'package.json', JSON.stringify({ scripts: { validate: 'true', build: 'true' } }));
  write(root, 'README.md', '# Widget documentation\n');
  write(root, 'content/widgets.md', '# Widgets\n\nUse listWidgets to read /widgets.\n\n```bash\ncurl https://example.test/widgets\ncurl https://example.test/legacy\n```\n');
  const base = commit(root);
  const updated = spec();
  delete updated.paths['/legacy'];
  updated.paths['/widgets'].parameters = [{ name: 'tenant', in: 'query', required: true, schema: { type: 'string' } }];
  updated.components.schemas.Widget.properties.id.type = 'integer';
  write(root, 'sources/openapi.json', JSON.stringify(updated));
  write(root, 'src/client.ts', 'export function listWidgets(tenant: string) { return fetch(`/widgets?tenant=${tenant}`); }\n');
  const head = commit(root);
  return { root, base, head, plan: planMaintenance(root, { base, head }) };
};

const withExecutables = (_root, executables, callback) => {
  const bin = temp();
  for (const [name, source] of Object.entries(executables)) {
    const file = join(bin, name);
    writeFileSync(file, `#!/usr/bin/env node\n${source}\n`);
    chmodSync(file, 0o755);
  }
  const priorPath = process.env.PATH;
  process.env.PATH = `${bin}:${priorPath}`;
  try { return callback(); } finally { process.env.PATH = priorPath; }
};

const withEnvironment = (values, callback) => {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  const apply = (entries) => { for (const [key, value] of Object.entries(entries)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } };
  apply(values);
  try { return callback(); } finally { apply(previous); }
};

test('YAML defaults and glob matching cover root and nested Markdown', () => {
  assert.equal(maintenanceSchema.parse(undefined).enabled, false);
  assert.equal(matchesGlob('content/intro.md', 'content/**/*.md'), true);
  assert.equal(matchesGlob('content/deep/intro.md', 'content/**/*.md'), true);
  assert.equal(matchesGlob('README.md', 'README.md'), true);
  assert.equal(matchesGlob('READMEamd', 'README.md'), false);
  assert.equal(matchesGlob('scripts/maintain.mjs', 'content/**/*.md'), false);
  assert.throws(() => maintenanceSchema.parse({ docs: ['../**'] }));
  assert.throws(() => maintenanceSchema.parse({ breakingChangesFile: '/tmp/change.md' }));
  assert.throws(() => maintenanceSchema.parse({ model: 'model\nhead=injected' }));
});

test('trusted example checks execute explicitly and stop on a failing example', () => {
  const root = temp();
  const settings = maintenanceSchema.parse({ exampleChecks: [{ name: 'Actual assertion', command: [process.execPath, '-e', 'require("node:assert/strict").equal(2 + 2, 4)'] }] });
  assert.deepEqual(runExampleChecks(root, settings), ['Actual assertion']);
  settings.exampleChecks[0].command = [process.execPath, '-e', 'process.exit(2)'];
  assert.throws(() => runExampleChecks(root, settings), /failed \(2\)/);
  assert.throws(() => maintenanceSchema.parse({ exampleChecks: [{ name: 'bad', command: ['node\nother'] }] }));
});

test('example check commands are protected from changes proposed by the agent', () => {
  const { root, plan } = fixture();
  const config = load(read(root, 'docsy.config.yaml'));
  config.maintenance.exampleChecks = [{ name: 'injected', command: ['node', '-e', 'process.exit(0)'] }];
  write(root, 'docsy.config.yaml', dump(config));
  assert.throws(() => guardChanges(root, plan), /protected YAML/);
});

test('OpenAPI comparison follows component refs and inherited required parameters', () => {
  const before = spec();
  const after = spec();
  delete after.paths['/legacy'];
  after.paths['/widgets'].parameters = [{ name: 'tenant', in: 'query', required: true, schema: { type: 'string' } }];
  after.components.schemas.Widget.properties.id.type = 'integer';
  const changes = compareOpenApi(dump(before), JSON.stringify(after));
  assert.ok(changes.some((change) => change.kind === 'removed-operation' && change.severity === 'breaking'));
  assert.ok(changes.some((change) => change.kind === 'added-parameter' && change.parameter === 'tenant' && change.severity === 'breaking'));
  assert.ok(changes.some((change) => change.kind === 'changed-response' && change.severity === 'review'));
});

test('Swagger body schema, auth changes, optional parameters, and additions are detected', () => {
  const before = { swagger: '2.0', info: { title: 'Test', version: '1' }, paths: { '/items': { post: { parameters: [{ in: 'body', name: 'body', schema: { type: 'object' } }], responses: {} } } } };
  const after = structuredClone(before);
  after.paths['/items'].post.parameters[0].schema.required = ['name'];
  after.paths['/items'].post.parameters.push({ in: 'query', name: 'page', type: 'string' });
  after.security = [{ apiKey: [] }];
  after.paths['/new'] = { get: { responses: {} } };
  const changes = compareOpenApi(dump(before), dump(after));
  assert.ok(changes.some((change) => change.kind === 'changed-parameter'));
  assert.ok(changes.some((change) => change.kind === 'changed-security'));
  assert.ok(changes.some((change) => change.kind === 'added-parameter' && change.severity === 'additive'));
  assert.ok(changes.some((change) => change.kind === 'added-operation'));
});

test('recursive schema references terminate and descriptions do not become breaking findings', () => {
  const before = spec();
  before.components.schemas.Widget.properties.child = { $ref: '#/components/schemas/Widget' };
  const after = structuredClone(before);
  after.paths['/widgets'].get.summary = 'Read widgets';
  assert.equal(compareOpenApi(dump(before), dump(after)).every((change) => change.severity === 'documentation'), true);
});

test('stale-example matching recognizes concrete IDs for OpenAPI path placeholders', () => {
  const results = findDocImpact([{ path: 'content/users.md', text: '```bash\ncurl https://api.example.test/users/123\n```' }],
    [{ endpoint: 'GET /users/{id}', path: '/users/{id}', kind: 'removed-operation', detail: 'Removed', severity: 'breaking' }], [], []);
  assert.equal(results.length, 1);
  assert.ok(results[0].staleExamples[0].includes('removed endpoint'));
});

test('plan identifies affected prose, stale examples, and changed symbols from Git commits', () => {
  const { plan } = fixture();
  assert.equal(plan.status, 'ready');
  assert.equal(plan.watchedFiles.length, 2);
  const article = plan.affectedArticles.find((entry) => entry.path === 'content/widgets.md');
  assert.ok(article.reasons.some((reason) => reason.includes('listWidgets')));
  assert.ok(article.staleExamples.some((reason) => reason.includes('removed endpoint GET /legacy')));
  assert.ok(article.staleExamples.some((reason) => reason.includes('required parameter tenant')));
  assert.ok(maintenancePrompt(plan).includes('Never invent endpoint behavior'));
  assert.ok(maintenancePrompt(plan).includes('Do not commit, push'));
});

test('docs-only commits, ignored changes, and disabled maintenance skip the agent', () => {
  const { root, head } = fixture();
  write(root, 'content/widgets.md', '# Improved documentation');
  const docsHead = commit(root);
  assert.equal(planMaintenance(root, { base: head, head: docsHead }).status, 'no-source-changes');
  const config = load(read(root, 'docsy.config.yaml'));
  config.maintenance.enabled = false;
  write(root, 'docsy.config.yaml', dump(config));
  write(root, 'src/ignored.ts', '// comment');
  const disabledHead = commit(root);
  assert.equal(planMaintenance(root, { base: docsHead, head: disabledHead }).status, 'disabled');
  config.maintenance.enabled = true;
  config.maintenance.ignore = ['src/ignored.ts'];
  write(root, 'docsy.config.yaml', dump(config));
  write(root, 'src/ignored.ts', '// changed');
  const ignoredHead = commit(root);
  assert.equal(planMaintenance(root, { base: disabledHead, head: ignoredHead }).status, 'no-source-changes');
});

test('code-only changes trigger review even when the API contract is unchanged', () => {
  const { root, head } = fixture();
  write(root, 'src/client.ts', 'export function listWidgets(tenant: string) { throw new Error(tenant); }\n');
  const next = commit(root);
  const plan = planMaintenance(root, { base: head, head: next });
  assert.equal(plan.status, 'ready');
  assert.equal(plan.apiChanges.length, 0);
  assert.ok(plan.affectedArticles.some((article) => article.reasons.some((reason) => reason.includes('listWidgets'))));
});

test('maintenance settings and source paths support YAML environment fallbacks', () => {
  const { root, base } = fixture();
  const config = load(read(root, 'docsy.config.yaml'));
  config.maintenance.enabled = '${DOCSY_FIXTURE_ENABLED:-true}';
  config.maintenance.watch = ['${DOCSY_FIXTURE_SOURCE_DIR:-sources}/**'];
  config.ingestion.openapi.source = '${DOCSY_FIXTURE_SPEC:-sources/openapi.json}';
  write(root, 'docsy.config.yaml', dump(config));
  const head = commit(root);
  const plan = planMaintenance(root, { base, head });
  assert.equal(plan.status, 'ready');
  assert.ok(plan.apiChanges.some((change) => change.kind === 'removed-operation'));
});

test('plan supports source renames, bounded diff, and missing/invalid revisions', () => {
  const { root, head } = fixture();
  git(root, 'mv', 'src/client.ts', 'src/client renamed.ts');
  write(root, 'src/large.ts', 'export const change = 1;\n'.repeat(200));
  const config = load(read(root, 'docsy.config.yaml'));
  config.maintenance.maxDiffChars = 1000;
  write(root, 'docsy.config.yaml', dump(config));
  const next = commit(root);
  const plan = planMaintenance(root, { base: head, head: next });
  assert.ok(plan.watchedFiles.includes('src/client renamed.ts'));
  assert.equal(plan.diffTruncated, true);
  assert.equal(plan.diff.length, 1000);
  assert.throws(() => planMaintenance(root, {}), /--base/);
  assert.throws(() => planMaintenance(root, { base: '--help' }));
});

test('guard permits Markdown and article/navigation updates while protecting runtime settings', () => {
  const { root, plan } = fixture();
  write(root, 'content/new.md', '# New guide');
  const config = load(read(root, 'docsy.config.yaml'));
  config.content.articles.push({ slug: 'new', source: 'content/new.md', title: 'New' });
  config.navigation[0].items.push({ title: 'New', href: '/guides/new' });
  write(root, 'docsy.config.yaml', dump(config));
  assert.ok(guardChanges(root, plan).includes('content/new.md'));
  config.access.mode = 'open';
  write(root, 'docsy.config.yaml', dump(config));
  assert.throws(() => guardChanges(root, plan), /protected YAML/);
});

test('guard rejects scripts, dependencies, and article sources outside editable paths', () => {
  const { root, plan } = fixture();
  write(root, 'scripts/evil.mjs', 'process.exit(0)');
  assert.throws(() => guardChanges(root, plan), /cannot modify scripts/);
  rmSync(join(root, 'scripts/evil.mjs'));
  write(root, 'package.json', '{}');
  assert.throws(() => guardChanges(root, plan), /cannot modify package.json/);
  write(root, 'package.json', git(root, 'show', `${plan.head}:package.json`));
  const config = load(read(root, 'docsy.config.yaml'));
  config.content.articles.push({ slug: 'private', title: 'Private', source: 'sources/secret.md' });
  write(root, 'docsy.config.yaml', dump(config));
  assert.throws(() => guardChanges(root, plan), /outside the editable/);
});

test('API-only sites may register their first migration article', () => {
  const { root, base } = fixture();
  const config = load(read(root, 'docsy.config.yaml'));
  delete config.content;
  write(root, 'docsy.config.yaml', dump(config));
  const head = commit(root);
  const plan = planMaintenance(root, { base, head });
  config.content = { articles: [{ slug: 'migration', source: 'content/migration.md', title: 'Migration' }] };
  write(root, 'docsy.config.yaml', dump(config));
  write(root, 'content/migration.md', '# Migration');
  assert.ok(guardChanges(root, plan).includes('docsy.config.yaml'));
});

test('guard rejects both valid and dangling symlinks and agent commits', () => {
  const { root, plan } = fixture();
  symlinkSync(join(root, 'package.json'), join(root, 'content/link.md'));
  assert.throws(() => guardChanges(root, plan), /symlinks/);
  rmSync(join(root, 'content/link.md'));
  symlinkSync('/nonexistent/docsy-test-target', join(root, 'content/link.md'));
  assert.throws(() => guardChanges(root, plan), /symlinks/);
  rmSync(join(root, 'content/link.md'));
  write(root, 'content/widgets.md', '# Changed');
  commit(root);
  assert.throws(() => guardChanges(root, plan), /changed Git history/);
});

test('failed validation invalidates old artifacts and never prepares a PR patch', () => {
  const { root, plan } = fixture();
  write(root, 'content/widgets.md', '# Updated');
  write(root, '.docsy/maintenance/validated.patch', 'stale previous patch');
  withExecutables(root, { npm: 'process.exit(1);' }, () => {
    assert.throws(() => verifyMaintenance(root, plan), /npm run failed/);
  });
  assert.equal(read(root, '.docsy/maintenance/validated.patch'), '');
});

test('a failed production build stops publication after successful validation', () => {
  const { root, plan } = fixture();
  write(root, 'content/widgets.md', '# Updated');
  withExecutables(root, { npm: 'process.exit(process.argv.includes("build") ? 1 : 0);' }, () => {
    assert.throws(() => verifyMaintenance(root, plan), /npm run failed/);
  });
  assert.equal(read(root, '.docsy/maintenance/validated.patch'), '');
});

test('verified new Markdown is included in the patch and unresolved questions in the PR body', () => {
  const { root, plan } = fixture();
  write(root, 'content/new.md', '# Tenant migration');
  write(root, '.docsy/maintenance/agent-result.json', JSON.stringify({ summary: 'Updated widget docs.', breakingChanges: ['tenant is required'], staleExamples: ['Added tenant to curl'], unresolved: ['Confirm token scopes.'] }));
  const result = withExecutables(root, { npm: 'process.exit(0);' }, () => verifyMaintenance(root, plan));
  assert.equal(result.changed, true);
  assert.ok(read(root, '.docsy/maintenance/validated.patch').includes('content/new.md'));
  assert.ok(read(root, '.docsy/maintenance/pr-body.md').includes('Confirm token scopes.'));
});

test('no-op agent output creates no validation run or PR patch', () => {
  const { root, plan } = fixture();
  const result = withExecutables(root, { npm: 'throw new Error("must not run");' }, () => verifyMaintenance(root, plan));
  assert.equal(result.changed, false);
  assert.equal(read(root, '.docsy/maintenance/validated.patch'), '');
});
test('rendered preview metadata excludes server builds and reports the exact example-validation boundary', () => {
  for (const github of [false, true]) for (const server of [true, false]) {
    const { root, base } = fixture();
    const config = load(read(root, 'docsy.config.yaml'));
    config.access.mode = server ? 'locked' : 'open';
    config.agent = { query: false };
    write(root, 'docsy.config.yaml', dump(config));
    const head = commit(root); const plan = planMaintenance(root, { base, head });
    write(root, 'content/widgets.md', '# Updated widgets');
    write(root, 'dist/index.html', '<html>Rendered preview</html>');
    withEnvironment({ GITHUB_RUN_ID: github ? '1234' : undefined, GITHUB_REPOSITORY: github ? 'example/docs' : undefined, GITHUB_SERVER_URL: 'https://ci.example.test' }, () => {
      withExecutables(root, { npm: 'process.exit(0);' }, () => verifyMaintenance(root, plan));
    });
    const preview = JSON.parse(read(root, '.docsy/maintenance/preview.json'));
    assert.equal(preview.available, !server); assert.equal(preview.published, false);
    assert.match(read(root, '.docsy/maintenance/pr-body.md'), /No executable example checks configured/);
    const body = read(root, '.docsy/maintenance/pr-body.md');
    assert.match(body, server ? /intentionally unavailable/ : github ? /https:\/\/ci.example.test\/example\/docs\/actions\/runs\/1234/ : /npm run preview/);
    if (!server && github) assert.match(body, /docsy-static-preview/);
  }
});

test('local run invokes Codex, validates outside the agent, and retains changes for review', () => {
  const { root, plan } = fixture();
  withExecutables(root, {
    codex: `import { writeFileSync } from 'node:fs';
      const args = process.argv.slice(2);
      if (!args.includes('workspace-write') || !args.includes('--output-schema')) process.exit(2);
      if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) process.exit(3);
      writeFileSync('content/widgets.md', '# Tenant migration\\nAdd tenant to GET /widgets.');
      writeFileSync(args[args.indexOf('--output-last-message') + 1], JSON.stringify({ summary: 'Updated docs', breakingChanges: [], staleExamples: [], unresolved: [] }));`,
    npm: 'process.exit(0);',
  }, () => runMaintenance(root, plan));
  assert.ok(read(root, 'content/widgets.md').includes('Tenant migration'));
  assert.ok(read(root, '.docsy/maintenance/validated.patch').includes('Tenant migration'));
  assert.equal(git(root, 'rev-parse', 'HEAD'), plan.head);
});

test('verified patch applies and validates independently in a fresh checkout', () => {
  const { root, base, head, plan } = fixture();
  write(root, 'content/new.md', '# Migration');
  withExecutables(root, { npm: 'process.exit(0);' }, () => verifyMaintenance(root, plan));
  const copy = temp();
  execFileSync('git', ['clone', '--quiet', root, copy]);
  const fresh = planMaintenance(copy, { base, head });
  write(copy, '.docsy/maintenance/proposed.patch', read(root, '.docsy/maintenance/validated.patch'));
  withExecutables(copy, { npm: 'process.exit(0);' }, () => verifyMaintenance(copy, fresh, { patch: '.docsy/maintenance/proposed.patch' }));
  assert.equal(read(copy, 'content/new.md'), '# Migration');
});

test('publisher pushes a dedicated branch and creates a draft with a body file', () => {
  const { root, plan } = fixture();
  const remote = temp();
  execFileSync('git', ['init', '--bare', '--quiet', remote]);
  git(root, 'remote', 'add', 'origin', remote);
  git(root, 'push', '-u', 'origin', 'main');
  write(root, 'content/widgets.md', '# Migration');
  withExecutables(root, { npm: 'process.exit(0);' }, () => verifyMaintenance(root, plan));
  const url = withExecutables(root, { gh: `const args = process.argv.slice(2);
    if (args[0] === 'pr' && args[1] === 'list') console.log('[]');
    else if (args[0] === 'pr' && args[1] === 'create' && args.includes('--draft') && args.includes('--body-file')) console.log('https://example.test/pull/1');
    else process.exit(2);` }, () => publishPullRequest(root, { source: plan.head, targetBranch: 'main' }));
  assert.equal(url, 'https://example.test/pull/1');
  const branch = `codex/docs-maintenance-${plan.head.slice(0, 12)}`;
  assert.equal(git(root, 'branch', '--show-current'), branch);
  assert.ok(git(root, 'ls-remote', 'origin', `refs/heads/${branch}`));
});

test('publisher returns an existing PR without another commit or push', () => {
  const { root, plan } = fixture();
  write(root, 'content/widgets.md', '# Migration');
  withExecutables(root, { npm: 'process.exit(0);' }, () => verifyMaintenance(root, plan));
  const url = withExecutables(root, { gh: 'console.log(JSON.stringify([{url:"https://example.test/pull/existing"}]));' }, () => publishPullRequest(root, { source: plan.head, targetBranch: 'main' }));
  assert.equal(url, 'https://example.test/pull/existing');
  assert.equal(git(root, 'rev-parse', 'HEAD'), plan.head);
});

test('generated projects include the maintenance workflow, command, and opt-in YAML', () => {
  const directory = temp();
  const target = join(directory, 'site');
  execFileSync(process.execPath, ['scripts/create-docsy.mjs', target, '--yes', '--no-install', '--name', 'Widgets'], { cwd: process.cwd() });
  assert.ok(existsSync(join(target, '.github/workflows/docsy-maintenance.yml')));
  assert.ok(existsSync(join(target, 'scripts/maintenance/result.schema.json')));
  assert.equal(JSON.parse(read(target, 'package.json')).scripts.maintain, 'node scripts/docsy.mjs maintain');
  assert.equal(load(read(target, 'docsy.config.yaml')).maintenance.enabled, false);
  assert.equal(load(read(target, 'docsy.config.yaml')).home.articleLayout, 'grid');
  assert.ok(existsSync(join(target, 'src/components/docs/ArticleCard.astro')));
  assert.ok(read(target, 'src/components/docs/Overview.astro').includes('layout={home.articleLayout}'));
  assert.ok(read(target, '.gitignore').includes('.docsy/maintenance/'));
});
