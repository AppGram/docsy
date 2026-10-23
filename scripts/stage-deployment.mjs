import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';

const root = process.cwd();
const configPath = resolve(root, process.env.DOCSY_CONFIG || 'docsy.config.yaml');
const config = load(readFileSync(configPath, 'utf8')) || {};
const basePath = config?.site?.basePath || '/';
const segment = basePath.replace(/^\/+|\/+$/g, '');
const release = resolve(root, 'release');
const target = segment ? resolve(release, segment) : release;

rmSync(release, { recursive: true, force: true });
mkdirSync(release, { recursive: true });

if (existsSync(resolve(root, 'dist/server/entry.mjs'))) {
  console.log('Docsy lock mode uses the Astro Node server; no static staging required.');
  process.exit(0);
}

mkdirSync(target, { recursive: true });
cpSync(resolve(root, 'dist'), target, { recursive: true });

if (segment) {
  // Static hosts select the error document at their web root, while its
  // absolute asset/recovery URLs still include the configured docs mount.
  if (existsSync(resolve(target, '404.html'))) cpSync(resolve(target, '404.html'), resolve(release, '404.html'));
  writeFileSync(resolve(release, 'index.html'), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0;url=/${segment}/">
    <link rel="canonical" href="/${segment}/">
    <title>Documentation</title>
  </head>
  <body><a href="/${segment}/">Open documentation</a></body>
</html>\n`);
}

console.log(`Staged Docsy at release/${segment || '.'}`);
