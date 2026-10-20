import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { assertWorkflowPublish, releaseManifest, sha256 } from './package.mjs';

const pkg = releaseManifest(process.cwd());
assertWorkflowPublish(pkg);
const directory = resolve('.docsy/packages/release');
const artifact = JSON.parse(readFileSync(resolve(directory, 'package-manifest.json'), 'utf8'));
const report = JSON.parse(readFileSync(resolve(directory, 'package-test.json'), 'utf8'));
assert.equal(artifact.name, pkg.name); assert.equal(artifact.version, pkg.version);
assert.equal(artifact.filename, `${pkg.name.replace(/^@/, '').replace('/', '-')}-${pkg.version}.tgz`);
assert.equal(basename(artifact.filename), artifact.filename);
assert.equal(report.result, 'passed'); assert.equal(report.artifact.sha256, artifact.sha256);
assert.equal(report.commit, process.env.GITHUB_SHA, 'Artifact was tested at another commit');
const file = resolve(directory, artifact.filename);
assert.ok(lstatSync(file).isFile() && !lstatSync(file).isSymbolicLink());
assert.equal(sha256(file), artifact.sha256, 'Tested tarball checksum differs');
// Publish the exact tested archive, never a freshly repacked working directory.
execFileSync('npm', ['publish', file, '--access', 'public', '--provenance', '--ignore-scripts', '--tag', process.env.DOCSY_NPM_TAG], { stdio: 'inherit' });
