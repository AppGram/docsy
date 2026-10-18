// Optional integration check: uses the developer's authenticated Codex CLI.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { dump, load } from 'js-yaml';
import { planMaintenance, runMaintenance } from '../scripts/maintenance.mjs';

const directory = mkdtempSync(join(tmpdir(), 'docsy-maintenance-live-'));
const project = join(directory, 'site');
const source = {
  openapi: '3.0.3', info: { title: 'Widget API', version: '1.0.0' },
  servers: [{ url: 'https://api.example.test' }],
  paths: {
    '/v1/widgets': { get: { tags: ['Widgets'], operationId: 'listWidgets', summary: 'List widgets', responses: { 200: { description: 'Widgets', content: { 'application/json': { schema: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' } } } } } } } } } },
    '/v1/legacy-widgets': { get: { tags: ['Widgets'], operationId: 'legacyWidgets', summary: 'Legacy list', responses: { 200: { description: 'Legacy widgets' } } } },
  },
};
const input = join(directory, 'openapi.json');
writeFileSync(input, JSON.stringify(source, null, 2));
execFileSync(process.execPath, ['scripts/create-docsy.mjs', project, '--yes', '--no-install', '--name', 'Widget API', '--openapi', input], { stdio: 'inherit' });
symlinkSync(resolve('node_modules'), join(project, 'node_modules'));
const configPath = join(project, 'docsy.config.yaml');
const config = load(readFileSync(configPath, 'utf8'));
config.maintenance.enabled = true;
writeFileSync(configPath, dump(config));
writeFileSync(join(project, 'content/getting-started.md'), `List widgets with GET /v1/widgets. Widget id values are strings.\n\n## List widgets\n\n\`\`\`bash\ncurl https://api.example.test/v1/widgets\n\`\`\`\n\n## Legacy clients\n\nUse GET /v1/legacy-widgets for the older list.\n\n\`\`\`bash\ncurl https://api.example.test/v1/legacy-widgets\n\`\`\`\n`);
const git = (...args) => execFileSync('git', args, { cwd: project, encoding: 'utf8' }).trim();
git('init', '-b', 'main');
git('config', 'user.name', 'Docsy Integration Test');
git('config', 'user.email', 'docsy@example.test');
git('add', '.');
git('commit', '-m', 'Initial documented API');
const base = git('rev-parse', 'HEAD');
delete source.paths['/v1/legacy-widgets'];
source.paths['/v1/widgets'].get.parameters = [{ in: 'query', name: 'tenantId', required: true, schema: { type: 'string' }, description: 'Tenant whose widgets should be returned.' }];
source.paths['/v1/widgets'].get.responses[200].content['application/json'].schema.items.properties.id.type = 'integer';
source.info.version = '2.0.0';
writeFileSync(join(project, 'sources/openapi.json'), JSON.stringify(source, null, 2));
git('add', 'sources/openapi.json');
git('commit', '-m', 'Require tenantId and remove legacy widgets endpoint');
const plan = planMaintenance(project, { base });
console.log(`Live maintenance fixture: ${project}`);
runMaintenance(project, plan);
assert.ok(existsSync(join(project, 'release/docs/guides/getting-started/index.html')));
const article = readFileSync(join(project, 'content/getting-started.md'), 'utf8');
assert.ok(article.includes('tenantId'), 'The live agent must update the example with the required tenantId.');
assert.ok(existsSync(join(project, config.maintenance.breakingChangesFile)), 'The live agent must explain the breaking changes.');
const patch = readFileSync(join(project, '.docsy/maintenance/validated.patch'), 'utf8');
assert.ok(patch.includes('tenantId'));
assert.equal(git('rev-parse', 'HEAD'), plan.head, 'Local maintenance must leave the update uncommitted for review.');
console.log(`Live Codex update and production validation passed. Review ${project}/.docsy/maintenance/pr-body.md`);
