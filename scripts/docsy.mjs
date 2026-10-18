#!/usr/bin/env node

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = process.cwd();
const ownRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [command = 'help', ...args] = process.argv.slice(2);

const run = (executable, commandArgs) => {
  const result = spawnSync(executable, commandArgs, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const astroBinary = () => {
  const suffix = process.platform === 'win32' ? '.cmd' : '';
  const local = resolve(projectRoot, `node_modules/.bin/astro${suffix}`);
  const bundled = resolve(ownRoot, `node_modules/.bin/astro${suffix}`);
  if (existsSync(local)) return local;
  if (existsSync(bundled)) return bundled;
  throw new Error('Astro is not installed. Run npm install first.');
};

const help = () => {
  console.log(`Docsy

Usage:
  docsy create <directory> [options]
  docsy dev [astro options]
  docsy validate
  docsy build
  docsy preview
  docsy doctor
  docsy upgrade --from <fresh-generated-project>
  docsy migrate mintlify --source <local-export> --out <new-directory>
  docsy maintain <plan|run|verify> --base <git-ref>

Commands:
  create    Generate an editable Docsy project from the reference UI
  dev       Start the local Astro development server
  validate  Validate YAML and type-check the generated site
  build     Validate, build, and stage production output
  preview   Serve the staged static build or locked Node build
  maintain  Detect documentation impact, run the coding agent, and validate a draft PR
  doctor    Check local prerequisites and explain the path to a live URL
  upgrade   Report upstream changes/conflicts; never overwrite customized files
  migrate   Import supported local Mintlify content, navigation, assets and redirects
`);
};

const loader = pathToFileURL(resolve(ownRoot, 'node_modules/tsx/dist/loader.mjs')).href;
const validateContent = () => run(process.execPath, ['--import', loader, resolve(projectRoot, 'scripts/validate-content.ts')]);

if (command === '--version' || command === '-v' || command === 'version') {
  const manifest = resolve(projectRoot, '.docsy/template.json');
  console.log(existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')).templateVersion : JSON.parse(readFileSync(resolve(ownRoot, 'package.json'), 'utf8')).version);
} else if (command === 'doctor') {
  const { doctor } = await import('./project-tools.mjs');
  if (!doctor(projectRoot)) process.exitCode = 1;
} else if (command === 'upgrade') {
  if (args.length !== 2 || args[0] !== '--from') throw new Error('Usage: docsy upgrade --from <fresh-generated-project>. This is a read-only comparison, not an automatic updater.');
  const { inspectUpgrade } = await import('./project-tools.mjs');
  inspectUpgrade(projectRoot, resolve(projectRoot, args[1]));
} else if (command === 'migrate') {
  const { main } = await import('./migrate-mintlify.mjs');
  main(args);
} else if (command === 'maintain') {
  const { main } = await import('./maintenance.mjs');
  await main(args).catch((error) => { console.error(error.message); process.exitCode = 1; });
} else if (command === 'create') {
  process.argv.splice(2, 1);
  await import('./create-docsy.mjs');
} else if (command === 'dev') {
  run(astroBinary(), ['dev', ...args]);
} else if (command === 'validate' || command === 'check') {
  validateContent();
  run(astroBinary(), ['check', ...args]);
} else if (command === 'build') {
  validateContent();
  for (const output of ['dist', 'release']) {
    rmSync(resolve(projectRoot, output), { recursive: true, force: true });
  }
  run(astroBinary(), ['check']);
  run(astroBinary(), ['build', ...args]);
  run(process.execPath, ['--import', loader, resolve(projectRoot, 'scripts/check-output-links.ts')]);
  run(process.execPath, [resolve(projectRoot, 'scripts/stage-deployment.mjs')]);
} else if (command === 'preview' || command === 'start') {
  run(process.execPath, [resolve(projectRoot, 'scripts/start.mjs'), ...args]);
} else if (command === 'help' || command === '--help' || command === '-h') {
  help();
} else {
  console.error(`Unknown Docsy command: ${command}\n`);
  help();
  process.exit(1);
}
