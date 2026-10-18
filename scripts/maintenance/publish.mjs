import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const publishPullRequest = (root, { source, targetBranch }) => {
  const run = (executable, args) => execFileSync(executable, args, { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }).trim();
  if (!/^[a-f0-9]{40,64}$/.test(source ?? '')) throw new Error('A source commit SHA is required.');
  if (run('git', ['rev-parse', 'HEAD']) !== source) throw new Error('Publishing requires the original source commit to be checked out.');
  const patch = resolve(root, '.docsy/maintenance/validated.patch');
  const body = resolve(root, '.docsy/maintenance/pr-body.md');
  if (!existsSync(patch) || !readFileSync(patch, 'utf8').trim()) return null;
  if (!existsSync(body)) throw new Error('Validated maintenance PR description is missing.');
  const branch = `codex/docs-maintenance-${source.slice(0, 12)}`;
  const existing = JSON.parse(run('gh', ['pr', 'list', '--head', branch, '--state', 'all', '--json', 'url']));
  if (existing.length) { console.log(`Maintenance PR already exists: ${existing[0].url}`); return existing[0].url; }
  const base = targetBranch || JSON.parse(run('gh', ['repo', 'view', '--json', 'defaultBranchRef'])).defaultBranchRef.name;
  run('git', ['check-ref-format', '--branch', base]);
  // In CI the validated patch arrives in a fresh checkout. Local run already has it applied.
  const trackedChanges = run('git', ['diff', '--name-only', 'HEAD', '--']);
  if (!trackedChanges) run('git', ['apply', '--index', '--', patch]);
  run('git', ['switch', '-c', branch, source]);
  run('git', ['add', '-u']);
  run('git', ['commit', '-m', `docs: maintain documentation for ${source.slice(0, 12)}`]);
  run('git', ['push', 'origin', branch]);
  const url = run('gh', ['pr', 'create', '--draft', '--base', base, '--head', branch,
    '--title', `docs: update documentation for ${source.slice(0, 12)}`, '--body-file', body]);
  console.log(url);
  return url;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    publishPullRequest(process.cwd(), { source: process.env.DOCSY_SOURCE_SHA, targetBranch: process.env.DOCSY_TARGET_BRANCH });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
