import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { assertPublishConfirmation, assertWorkflowPublish, auditPackageFiles, releaseManifest } from '../scripts/release/package.mjs';

const text = readFileSync(new URL('../.github/workflows/release-npm.yml', import.meta.url), 'utf8');
const workflow = load(text), pkg = releaseManifest(process.cwd());
test('npm publication is manual, main-only, verified-artifact-only and disabled by default', () => {
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.equal(workflow.on.workflow_dispatch.inputs.publish.default, false);
  assert.equal(workflow.permissions['id-token'], undefined);
  assert.match(workflow.jobs.verify.if, /github.ref == 'refs\/heads\/main'/);
  assert.match(workflow.jobs.verify.if, /github.repository == 'AppGram\/docsy'/);
  assert.equal(workflow.jobs.publish.needs, 'verify');
  assert.match(workflow.jobs.publish.if, /inputs.publish == true/);
  assert.match(workflow.jobs.publish.if, /DOCSY_ENABLE_NPM_PUBLISH == 'true'/);
  assert.equal(workflow.jobs.publish.environment, 'npm-release');
  assert.equal(workflow.jobs.publish.permissions['id-token'], 'write');
  assert.ok(workflow.jobs.verify.steps.some(step => step.run === 'npm run test:package'));
  assert.ok(workflow.jobs.publish.steps.some(step => step.run === 'node scripts/release/publish.mjs'));
  assert.ok(!text.includes('secrets.')); assert.ok(!text.includes('NPM_TOKEN'));
  for (const job of Object.values(workflow.jobs)) for (const step of job.steps) if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/);
});
test('every release gate fails closed and a prerelease cannot be tagged latest', () => {
  const env = { DOCSY_CONFIRM_NPM_PUBLISH: `${pkg.name}@${pkg.version}`, DOCSY_ENABLE_NPM_PUBLISH: 'true', DOCSY_RELEASE_REQUESTED: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REPOSITORY: 'AppGram/docsy', GITHUB_REF: 'refs/heads/main', DOCSY_NPM_TAG: 'latest' };
  assert.doesNotThrow(() => assertWorkflowPublish(pkg, env));
  for (const key of Object.keys(env)) assert.throws(() => assertWorkflowPublish(pkg, { ...env, [key]: '' }), key);
  assert.throws(() => assertWorkflowPublish(pkg, { ...env, NODE_AUTH_TOKEN: 'not-a-real-token' }), /trusted publisher/);
  const prerelease = { ...pkg, version: '0.4.1-beta.1' };
  assert.throws(() => assertWorkflowPublish(prerelease, { ...env, DOCSY_CONFIRM_NPM_PUBLISH: `${pkg.name}@${prerelease.version}` }), /prerelease/);
  assert.throws(() => assertPublishConfirmation(pkg, {}), /explicit confirmation/);
});
test('the prepublish hook allows inspection but refuses accidental publication without confirmation', () => {
  const env = { ...process.env }; delete env.DOCSY_CONFIRM_NPM_PUBLISH; delete env.npm_config_dry_run;
  assert.throws(() => execFileSync(process.execPath, ['scripts/release/prepublish.mjs'], { env, stdio: 'pipe' }), /explicit confirmation/);
  assert.match(execFileSync(process.execPath, ['scripts/release/prepublish.mjs'], { env: { ...env, npm_config_dry_run: 'true' }, encoding: 'utf8' }), /manifest verified/);
});
test('the archive audit rejects missing templates, credentials, checkout dependencies and unsafe paths', () => {
  assert.throws(() => auditPackageFiles([]), /Missing packaged template/);
  const paths = ['package.json','LICENSE','README.md','astro.config.mjs','tsconfig.json','Dockerfile','Dockerfile.bun','.dockerignore','.github/workflows/docsy-maintenance.yml','scripts/docsy.mjs','scripts/create-docsy.mjs','scripts/scaffold/gitignore','scripts/scaffold/index.astro','scripts/scaffold/format-md.ts','scripts/scaffold/workflows.mjs','scripts/start.mjs','scripts/lib/http-range.mjs','scripts/validate-content.ts','src/config.ts','src/components/docs/AuthorBadge.astro','public/assets/authors/unknown.svg','content/reference/upgrading.md'];
  paths.push('scripts/release/package.mjs', 'scripts/release/prepublish.mjs', 'scripts/release/publish.mjs', 'scripts/pack-package.mjs');
  const files = paths.map(path => ({ path })); assert.doesNotThrow(() => auditPackageFiles(files));
  assert.throws(() => auditPackageFiles(files.filter(file => file.path !== 'scripts/release/prepublish.mjs')), /Missing packaged release tool/);
  for (const path of ['.env', 'public/.env.production', '.npmrc', 'scripts/id_rsa', 'node_modules/private/index.js', 'dist/index.html', '../outside', '/absolute', 'docs/npm-release.md']) assert.throws(() => auditPackageFiles([...files, { path }]), path);
});
