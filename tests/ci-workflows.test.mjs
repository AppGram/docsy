import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const checksText = read('.github/workflows/checks.yml');
const checks = load(checksText);
const pages = load(read('.github/workflows/pages.yml'));

test('PR CI validates main and merge queues without secrets or privileged PR execution', () => {
  assert.deepEqual(checks.on.pull_request.branches, ['main']);
  assert.ok(checks.on.pull_request.types.includes('synchronize'));
  assert.ok(Object.hasOwn(checks.on, 'merge_group'));
  assert.ok(Object.hasOwn(checks.on, 'workflow_dispatch'));
  assert.ok(!Object.hasOwn(checks.on, 'pull_request_target'));
  assert.deepEqual(checks.permissions, { contents: 'read' });
  assert.ok(!checksText.includes('secrets.'));
  assert.equal(checks.concurrency['cancel-in-progress'], true);
  for (const id of ['check', 'native-imports', 'bun-runtime', 'package']) {
    const job = checks.jobs[id];
    assert.ok(job['timeout-minutes'] > 0);
    assert.ok(!job.permissions);
    assert.equal(job.steps.find((step) => step.uses?.startsWith('actions/checkout@')).with['persist-credentials'], false);
    assert.ok(job.steps.some((step) => step.run === 'npm ci --ignore-scripts'));
    for (const step of job.steps) if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/, 'Actions are pinned to verified commits');
  }
});
test('CI builds reviewable static previews and requires Node, native imports and Bun to pass', () => {
  const node = checks.jobs.check;
  assert.ok(node.steps.some((step) => step.run === 'npm test'));
  assert.ok(node.steps.some((step) => step.run === 'npm run build'));
  assert.ok(node.steps.some((step) => step.uses?.startsWith('oven-sh/setup-bun@')));
  const preview = node.steps.find((step) => step.with?.name?.startsWith('docsy-static-preview-'));
  assert.equal(preview.if, "steps.preview.outputs.static == 'true'");
  assert.equal(preview.with.path, 'release');
  assert.equal(preview.with['retention-days'], 7);
  assert.ok(checks.jobs['native-imports'].steps.some((step) => step.run === 'npm run test:imports:real'));
  assert.ok(checks.jobs['bun-runtime'].steps.some((step) => step.run === 'npm run test:runtime:bun'));
  assert.equal(checks.jobs.ci.name, 'PR checks');
  assert.equal(checks.jobs.ci.if, 'always()');
  assert.ok(checks.jobs.package.steps.some((step) => step.run === 'npm run test:package'));
  assert.deepEqual(checks.jobs.ci.needs, ['check', 'native-imports', 'bun-runtime', 'package']);
  assert.match(checks.jobs.ci.steps[0].run, /job.result !== "success"/);
});
test('CD cannot deploy PRs and stays explicitly gated behind main CI and release approval', () => {
  const deploy = checks.jobs.pages;
  assert.equal(deploy.needs, 'ci');
  assert.match(deploy.if, /github.event_name == 'push'/);
  assert.match(deploy.if, /github.ref == 'refs\/heads\/main'/);
  assert.match(deploy.if, /vars.DOCSY_ENABLE_PAGES == 'true'/);
  assert.equal(deploy.uses, './.github/workflows/pages.yml');
  assert.ok(!Object.hasOwn(pages.on, 'push'));
  assert.ok(!Object.hasOwn(pages.on, 'pull_request'));
  assert.ok(Object.hasOwn(pages.on, 'workflow_call'));
  assert.match(pages.jobs.build.if, /DOCSY_ENABLE_PAGES == 'true'/);
  assert.match(pages.jobs.build.if, /refs\/heads\/main/);
  assert.equal(pages.jobs.deploy.needs, 'build');
});
