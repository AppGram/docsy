// Collect compact evidence from completed local tests, never publish it.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const args = process.argv.slice(2);
if (args.length !== 3) throw new Error('Usage: node scripts/record-adoption-evidence.mjs <maintenance-project> <migrated-project> <upstream-export>');
const [maintenance, migrated, upstream] = args.map((path) => resolve(path));
const output = resolve('docs/evidence'); mkdirSync(output, { recursive: true });
const read = (root, path) => readFileSync(resolve(root, path), 'utf8');
const hash = (text) => createHash('sha256').update(text).digest('hex');
const git = (root, ...params) => execFileSync('git', params, { cwd: root, encoding: 'utf8' }).trim();
const imports = JSON.parse(read(process.cwd(), '.docsy/real-projects/report.json'));
assert.ok(read(migrated, 'dist/guides/quickstart/index.html').includes('Quickstart'), 'Expected built migration preview.');
const preview = JSON.parse(read(maintenance, '.docsy/maintenance/preview.json'));
assert.equal(preview.available, true); assert.equal(preview.published, false);
assert.equal(git(maintenance, 'remote'), '', 'This case must remain local, not a remote PR.');
execFileSync(process.execPath, ['tests/check-zod-example.mjs'], { cwd: maintenance, stdio: 'inherit' });
const patch = read(maintenance, '.docsy/maintenance/validated.patch'); assert.ok(patch.includes('issues'));
for (const [source, destination] of [['.docsy/maintenance/validated.patch', 'zod-maintenance.patch'], ['.docsy/maintenance/pr-body.md', 'zod-pr-body.md'], ['sources/ZOD-LICENSE', 'ZOD-LICENSE']]) cpSync(resolve(maintenance, source), resolve(output, destination));
cpSync(resolve(migrated, 'migration/report.json'), resolve(output, 'mintlify-migration.json'));
cpSync(resolve(upstream, 'LICENSE'), resolve(output, 'MINTLIFY-LICENSE'));
const plan = JSON.parse(read(maintenance, '.docsy/maintenance/report.json'));
const summary = {
  schemaVersion: 1, published: false, templateVersion: JSON.parse(read(process.cwd(), 'package.json')).version,
  imports: imports.projects.map(({ name, version, generator, input, output: artifact, symbols, examples }) => ({ name, version, generator, inputFiles: input.length, inputTreeSha256: hash(JSON.stringify(input)), artifactSha256: artifact.sha256, symbols, examples })),
  render: { checkedLinksAndAnchors: imports.render.checkedLinksAndAnchors, pages: imports.render.pages.map(({ path, bytes, sha256 }) => ({ name: path.split('/').at(-2), bytes, sha256 })) },
  migration: { repository: 'https://github.com/mintlify/starter', commit: git(upstream, 'rev-parse', 'HEAD'), report: 'mintlify-migration.json', renderedBuildPassed: true },
  maintenance: { package: 'zod@3.25.76', change: 'v3 API → bundled v4 compatibility export; error.errors removed, error.issues retained', base: plan.base, head: git(maintenance, 'rev-parse', 'HEAD'), agentUpdatedDocs: true, actualRuntimeExamplePassed: true, independentValidationAndBuildPassed: true, validatedPatchSha256: hash(patch), remotePrCreated: false, renderedPreviewPublished: false },
  limitations: ['Only three substantial JS/TS projects tested; other language fixtures remain small.', 'Runtime assertion covers one reviewed Zod example, not every imported example.', 'Native reference pages are currently monolithic; large libraries produce large HTML.', 'A local review bundle is not an actual GitHub PR or public deployment.'],
};
writeFileSync(resolve(output, 'adoption.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`Recorded private evidence under ${output}. Nothing published.`);
