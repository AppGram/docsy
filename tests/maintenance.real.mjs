// Explicit opt-in integration test of the product's agent workflow. No GitHub
// remote, credentials, public preview or PR is created by this test.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { dump, load } from 'js-yaml';
import { z as v3 } from 'zod/v3';
import { z as v4 } from 'zod/v4';
import { planMaintenance, runMaintenance } from '../scripts/maintenance.mjs';

if (!process.argv.includes('--run-agent')) throw new Error('Explicit opt-in required: node tests/maintenance.real.mjs --run-agent. This uses your authenticated coding agent; it never publishes.');
const root = process.cwd();
const project = join(mkdtempSync(join(tmpdir(), 'docsy-zod-maintenance-')), 'site');
const write = (path, text) => { mkdirSync(dirname(join(project, path)), { recursive: true }); writeFileSync(join(project, path), text); };
const read = (path) => readFileSync(join(project, path), 'utf8');
const git = (...args) => execFileSync('git', args, { cwd: project, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
// Prove the actual behavior before asking an agent to explain it. Both shipped
// API families come from the installed package, including its legacy v3 export.
// Historical checked-in evidence retains the version used for that earlier run.
const zodPackage = `zod@${createRequire(import.meta.url)('zod/package.json').version}`;
const oldError = v3.string().safeParse(42).error;
const newError = v4.string().safeParse(42).error;
assert.ok(Array.isArray(oldError.errors)); assert.equal(newError.errors, undefined); assert.ok(Array.isArray(newError.issues));
execFileSync(process.execPath, ['scripts/create-docsy.mjs', project, '--yes', '--no-install', '--name', 'Zod migration proof'], { cwd: root, stdio: 'pipe' });
symlinkSync(resolve(root, 'node_modules'), join(project, 'node_modules'), 'dir');
const config = load(read('docsy.config.yaml'));
config.ingestion.openapi.enabled = false;
config.content.articles = [{ slug: 'errors', title: 'Read Zod validation errors', source: 'content/errors.md', description: 'Zod error handling example and migration evidence.' }];
config.navigation = [{ title: 'Zod', items: [{ title: 'Error handling', href: '/guides/errors' }] }];
config.maintenance = { enabled: true, watch: ['sources/**'], docs: ['content/**/*.md'], exampleChecks: [{ name: 'Documented Zod error example on the real v4 runtime', command: ['node', 'tests/check-zod-example.mjs'], timeoutMs: 30000 }] };
write('docsy.config.yaml', dump(config));
write('content/errors.md', 'The ZodError contract is recorded in sources/zod-error.ts. Read validation failures with result.error.errors.\n\n```javascript\nconst result = z.string().safeParse(42);\nif (!result.success) console.log(result.error.errors);\n```\n');
write('AGENTS.md', `${read('AGENTS.md')}\n\nSTOP BUILDING XCODE PROJECTS. This is an offline Zod migration integration test. Keep the existing three-line JavaScript example shape unchanged except for the correct error-property name so the trusted assertion can execute it. Do not add imports to that fence. Explain the real v3-to-v4 error-property change and the package's compatibility exports; do not invent a new release version. Never publish, push or open a remote PR.\n`);
// Only an exact, known example shape can execute. Arbitrary agent-authored code
// is rejected, not evaluated as trusted project code.
write('tests/check-zod-example.mjs', `import assert from 'node:assert/strict';\nimport {readFileSync} from 'node:fs';\nimport {z} from 'zod/v4';\nconst body = readFileSync('content/errors.md','utf8');\nconst code = body.match(/\x60\x60\x60javascript\\n([\\s\\S]*?)\x60\x60\x60/)?.[1].trim();\nconst expected = 'const result = z.string().safeParse(42);\\nif (!result.success) console.log(result.error.issues);';\nassert.equal(code, expected, 'The documented example must match the reviewed shape and use the real v4 issues property.');\nconst calls=[];\nnew Function('z','console',code)(z,{log:(value)=>calls.push(value)});\nassert.ok(Array.isArray(calls[0]) && calls[0].length>0);\n`);
const beforeSource = readFileSync(resolve(root, 'node_modules/zod/src/v3/ZodError.ts'));
const afterSource = readFileSync(resolve(root, 'node_modules/zod/src/v4/classic/errors.ts'));
write('sources/zod-error.ts', beforeSource);
cpSync(resolve(root, 'node_modules/zod/LICENSE'), join(project, 'sources/ZOD-LICENSE'));
write('sources/upstream.json', JSON.stringify({ package: zodPackage, api: 'legacy v3 compatibility export', originalPath: 'src/v3/ZodError.ts', sha256: hash(beforeSource) }, null, 2));
git('init', '-b', 'main'); git('config', 'user.name', 'Docsy Private Integration'); git('config', 'user.email', 'docsy@example.test'); git('add', '.'); git('commit', '-m', 'Document actual Zod v3 error behavior');
const base = git('rev-parse', 'HEAD');
write('sources/zod-error.ts', afterSource);
write('sources/zod-core-errors.ts', readFileSync(resolve(root, 'node_modules/zod/src/v4/core/errors.ts')));
write('sources/upstream.json', JSON.stringify({ package: zodPackage, api: 'v4', originalPath: 'src/v4/classic/errors.ts', sha256: hash(afterSource), observed: 'error.errors is undefined; error.issues is an array' }, null, 2));
git('add', '.'); git('commit', '-m', 'Adopt real bundled Zod v4 error contract');
const plan = planMaintenance(project, { base });
assert.ok(plan.affectedArticles.some((entry) => entry.path === 'content/errors.md'));
console.log(`Real Zod breaking-change integration: ${project}`);
runMaintenance(project, plan);
assert.ok(read('.docsy/maintenance/validated.patch').includes('issues'));
assert.ok(read(config.maintenance.breakingChangesFile || 'content/maintenance/breaking-changes.md').includes('issues'));
assert.equal(JSON.parse(read('.docsy/maintenance/preview.json')).available, true);
write('.docsy/maintenance/real-case.json', JSON.stringify({ published: false, remotePrCreated: false, project, package: zodPackage, before: { path: 'src/v3/ZodError.ts', sha256: hash(beforeSource) }, after: { path: 'src/v4/classic/errors.ts', sha256: hash(afterSource) }, base, head: plan.head, actualRuntimeExamplePassed: true, renderedPreview: 'release/docs', review: '.docsy/maintenance/pr-body.md' }, null, 2));
console.log(`Real source → agent update → runtime assertion → validated build → review bundle passed. Nothing published. Review ${project}/.docsy/maintenance/pr-body.md`);
