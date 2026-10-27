import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { dump, load } from 'js-yaml';
import { packPackage, sha256 } from './release/package.mjs';

const root = process.cwd(), args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--out')) throw new Error('Usage: npm run test:package -- [--out <directory>]');
const output = resolve(args[1] || '.docsy/packages/release');
mkdirSync(output, { recursive: true });
const artifact = packPackage(root, output), tarball = resolve(output, artifact.filename);
const workspace = mkdtempSync(join(tmpdir(), 'docsy-package-e2e-'));
const consumer = join(workspace, 'consumer'), site = join(workspace, 'handbook');
const checks = [];
const env = { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', DOCSY_CONFIG: 'docsy.config.yaml', npm_config_cache: join(output, '.npm-cache') };
for (const key of ['NODE_PATH', 'NODE_OPTIONS', 'NODE_ENV', 'DOCSY_ORIGIN', 'NODE_AUTH_TOKEN', 'NPM_TOKEN']) delete env[key];
const write = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); };
const read = (path) => readFileSync(path, 'utf8');
let number = 0;
const run = (cwd, binary, commandArgs) => {
  const label = `${++number}-${commandArgs.filter(arg => !arg.startsWith('/')).join('-').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 65)}`;
  console.log(`Package E2E: ${binary} ${commandArgs.join(' ')}`);
  try {
    const result = execFileSync(binary, commandArgs, { cwd, env, encoding: 'utf8', timeout: 300_000, maxBuffer: 15 * 1024 * 1024 });
    write(join(output, `${label}.log`), result); return result;
  } catch (error) {
    const details = `${error.stdout ?? ''}\n${error.stderr ?? ''}`;
    write(join(output, `${label}.log`), details);
    throw new Error(`Package E2E command failed: ${label}\n${details.slice(-12000)}`, { cause: error });
  }
};
const port = () => new Promise((accept, reject) => { const socket = createServer(); socket.once('error', reject); socket.listen(0, '127.0.0.1', () => { const value = socket.address().port; socket.close(() => accept(value)); }); });
async function serve() {
  const value = await port();
  const process = spawn(globalThis.process.execPath, ['scripts/start.mjs'], { cwd: site, env: { ...env, HOST: '127.0.0.1', PORT: String(value) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; process.stdout.on('data', data => { logs = (logs + data).slice(-12000); }); process.stderr.on('data', data => { logs = (logs + data).slice(-12000); });
  const stop = async () => { if (process.exitCode !== null) return; process.kill('SIGTERM'); await new Promise(accept => { process.once('exit', accept); if (process.exitCode !== null) accept(); }); };
  for (let attempt = 0; attempt < 100; attempt++) {
    if (process.exitCode !== null) throw new Error(`Packaged site server exited: ${logs}`);
    try { if ((await fetch(`http://127.0.0.1:${value}/handbook/`, { signal: AbortSignal.timeout(2000) })).status === 200) return { base: `http://127.0.0.1:${value}/handbook`, stop }; } catch {}
    await delay(100);
  }
  await stop(); throw new Error(`Packaged site server did not start: ${logs}`);
}
let passed = false;
try {
  write(join(consumer, 'package.json'), JSON.stringify({ name: 'docsy-package-consumer', private: true }));
  run(consumer, 'npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball]);
  const installedRoot = join(consumer, 'node_modules/@appgram/docsy');
  assert.ok(!lstatSync(installedRoot).isSymbolicLink());
  assert.ok(realpathSync(installedRoot).startsWith(realpathSync(consumer) + '/'));
  assert.equal(JSON.parse(read(join(installedRoot, 'package.json'))).version, artifact.version);
  assert.equal(run(consumer, 'npm', ['exec', '--offline', '--no', '--', 'docsy', '--version']).trim(), artifact.version);
  checks.push('Real tarball installed into a clean consumer; npm bin and version verified; no checkout symlink');
  run(consumer, process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(import.meta.resolve('@appgram/docsy/package.json'));
    const { version } = require('zod/package.json');
    const [major, minor, patch] = version.split('.').map(Number);
    assert.ok(major > 4 || (major === 4 && (minor > 6 || (minor === 6 && patch >= 6))), version);
    const { z } = require('zod');
    let visited = 0;
    const result = z.array(z.unknown().transform(() => { visited++; })).max(2).safeParse(Array(20000).fill(null));
    assert.equal(result.success, false);
    assert.equal(result.error.issues.length, 1);
    assert.equal(result.error.issues[0].code, 'too_big');
    assert.equal(visited, 0);
    console.log('Installed patched Zod: ' + version);
  `]);
  checks.push('Installed package resolves patched Zod and rejects oversized collections before parsing elements');

  const input = join(workspace, 'inputs/api.yaml');
  write(input, dump({ openapi: '3.0.3', info: { title: 'Package-owned API', version: '1.0.0' }, paths: { '/v1/widgets': { get: { tags: ['widgets'], summary: 'List user widgets', responses: { 200: { description: 'Widgets', content: { 'application/json': { schema: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' } } } } } } } } } } } }));
  run(consumer, 'npm', ['exec', '--offline', '--no', '--', 'docsy', 'create', site, '--yes', '--no-install', '--name', 'Package Handbook', '--openapi', input, '--api-base', 'https://api.example.test', '--ci', '--deploy', 'github-pages', '--repo', 'https://github.com/example/handbook']);
  const pkg = JSON.parse(read(join(site, 'package.json')));
  assert.equal(pkg.private, true);
  assert.equal(pkg.docsy.templateVersion, artifact.version);
  for (const path of ['.gitignore', 'AGENTS.md', 'DOCSY_BRIEF.md', 'UPGRADING.md', 'DEPLOYING.md', 'Dockerfile.bun', '.github/workflows/docsy-maintenance.yml']) assert.ok(existsSync(join(site, path)), `Missing generated ${path}`);
  assert.match(read(join(site, '.github/workflows/pages.yml')), /DOCSY_ENABLE_PAGES == 'true'/);
  assert.ok(!existsSync(join(site, '.github/workflows/release-npm.yml')));
  checks.push('Installed docsy bin generated the editable project, version provenance, private project manifest and opt-in deployment workflows');

  const configPath = join(site, 'docsy.config.yaml'), config = load(read(configPath));
  config.sidebar = { iconSize: 18 };
  config.navigation[0].items[0].icon = 'lucide:house';
  config.navigation[0].items[1].icon = { src: 'assets/authors/unknown.svg', mode: 'mask' };
  config.notFound.title = 'Package 404 recovery';
  config.notFound.links = [{ label: 'Installed handbook', href: '/guides/package-handbook' }];
  const signal = 'tarball-onboarding-proof', privateSignal = 'tarball-private-proof';
  write(join(site, 'content/package-handbook.mdx'), `## Bring your own content\n\n<Note title="Installed from the tarball">${signal}</Note>\n\n<Drawio src="architecture" />\n\n<PlantUml src="uml" />\n\n\`\`\`mermaid Tarball sequence\nsequenceDiagram\nReader->>Docsy: Read installed docs\n\`\`\`\n\n\`\`\`typescript\nconst tarball = true;\n\`\`\`\n`);
  write(join(site, 'content/architecture.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 80"><rect width="160" height="80" fill="white"/><text x="10" y="40">Docsy architecture</text></svg>');
  const diagramSource = '<mxfile><diagram name="Architecture"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';
  write(join(site, 'content/architecture.drawio'), diagramSource);
  config.content.diagrams = { architecture: { image: 'content/architecture.svg', source: 'content/architecture.drawio', alt: 'Tarball diagram preview', caption: 'Diagram generated in the installed package test.' } };
  write(join(site, 'content/architecture.puml'), '@startuml\nReader -> Docsy: Read documentation\n@enduml\n');
  config.content.diagrams.uml = { format: 'plantuml', image: 'content/architecture.svg', source: 'content/architecture.puml', alt: 'Tarball UML preview' };
  write(join(site, 'content/private.md'), `## Internal contract\n\n${privateSignal}\n`);
  config.authors = { writer: { name: 'Package test writer', avatar: 'assets/authors/unknown.svg' } };
  config.content.articles.push({ slug: 'package-handbook', source: 'content/package-handbook.mdx', title: 'Package handbook', authors: ['writer'] }, { slug: 'private', source: 'content/private.md', title: 'Internal contract' });
  const nestedSlugs = Array.from({ length: 10 }, (_, level) => ['package-handbook', ...Array.from({ length: level }, (_, i) => `part-${i + 1}`)].join('/'));
  const nestedLeaf = nestedSlugs.at(-1), nestedSignal = 'tarball-nested-proof';
  let nestedNav;
  for (let i = nestedSlugs.length - 1; i >= 0; i--) {
    const slug = nestedSlugs[i];
    if (i > 0) {
      const source = `content/${slug}/index.mdx`;
      write(join(site, source), `## Nested content\n\n<Note>${i === 9 ? nestedSignal : 'Nested parent article.'}</Note>\n`);
      config.content.articles.push({ slug, source, title: `Package level ${i + 1}` });
    }
    nestedNav = { title: `Package level ${i + 1}`, href: `/guides/${slug}`, ...(nestedNav ? { items: [nestedNav] } : {}) };
  }
  config.navigation[0].items.push(nestedNav);
  write(configPath, dump(config));
  run(site, 'npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund']);
  assert.ok(!lstatSync(join(site, 'node_modules')).isSymbolicLink());
  const cli = join(installedRoot, 'scripts/docsy.mjs');
  run(site, globalThis.process.execPath, [cli, 'doctor']);
  run(site, globalThis.process.execPath, [cli, 'validate']);
  run(site, globalThis.process.execPath, [cli, 'build']);
  checks.push('Registry-installed generated dependencies; installed CLI validates and builds user OpenAPI and native MDX, including highlighted code and author metadata');

  let server = await serve();
  try {
    const html = await (await fetch(`${server.base}/guides/package-handbook`)).text();
    assert.match(html, new RegExp(signal)); assert.match(html, /Package test writer/);
    assert.match(html, /data-sidebar-icon="lucide:house"/); assert.match(html, /data-sidebar-icon="tabler:api"/);
    assert.match(html, /--sidebar-icon-size:18px/); assert.match(html, /data-sidebar-icon="custom"/);
    assert.doesNotMatch(html, /api\.iconify\.design|fonts\.googleapis/);
    assert.match(html, /data-docsy-diagram="architecture"/);
    assert.match(html, /download="architecture.drawio"/);
    assert.match(html, /download="architecture.puml"/); assert.match(html, /data-docsy-mermaid/);
    assert.ok(html.includes(`data:application/octet-stream;base64,${Buffer.from(diagramSource).toString('base64')}`));
    assert.equal((await fetch(`${server.base}/api/widgets`)).status, 200);
    assert.equal((await fetch(`${server.base}/assets/authors/unknown.svg`)).status, 200);
    const search = await (await fetch(`${server.base}/search-index.json`)).text(); assert.match(search, new RegExp(signal));
    const json = await (await fetch(`${server.base}/agent/pages/guides/package-handbook.json`)).json(); assert.equal(json.authorship.authors[0].name, 'Package test writer');
    assert.match(JSON.stringify(json), /Tarball diagram preview/); assert.ok(!JSON.stringify(json).includes('base64,'));
    assert.match(JSON.stringify(json), /sequenceDiagram/); assert.match(JSON.stringify(json), /Editable PlantUML/);
    assert.match(await (await fetch(`${server.base}/format-md/guides/package-handbook.md`)).text(), new RegExp(signal));
    assert.equal((await fetch(`${server.base}/format-md/guides/package-handbook`)).status, 404);
    for (const slug of nestedSlugs) {
      const markdown = await fetch(`${server.base}/format-md/guides/${slug}.md`);
      assert.equal(markdown.status, 200, slug);
      assert.match(await markdown.text(), /Bring your own content|Nested content/);
    }
    const nestedHtml = await (await fetch(`${server.base}/guides/${nestedLeaf}`)).text();
    assert.match(nestedHtml, /data-sidebar-depth="9"/); assert.match(nestedHtml, new RegExp(nestedSignal));
    assert.equal((nestedHtml.match(/aria-current="page"/g) ?? []).length, 1);
    const nestedJson = await (await fetch(`${server.base}/agent/pages/guides/${nestedLeaf}.json`)).json();
    assert.ok(nestedJson.markdownUrl.endsWith(`${nestedLeaf}.md`));
    const nestedMarkdown = await fetch(new URL(new URL(nestedJson.markdownUrl).pathname, server.base));
    assert.equal(nestedMarkdown.status, 200); assert.match(await nestedMarkdown.text(), new RegExp(nestedSignal));
    const css = html.match(/href="([^"]+\.css)"/); assert.ok(css); assert.equal((await fetch(new URL(css[1], server.base))).status, 200);
    const missing = await fetch(`${server.base}/guides/package-missing`, { redirect: 'manual' });
    assert.equal(missing.status, 404); assert.match(missing.headers.get('content-type'), /text\/html/);
    const missingHtml = await missing.text(); assert.match(missingHtml, /Package 404 recovery/);
    assert.match(missingHtml, /href="\/handbook\/guides\/package-handbook"/); assert.match(missingHtml, /noindex/);
    assert.doesNotMatch(search, /Package 404 recovery/);
  } finally { await server.stop(); }
  checks.push('Actual static server: article, generated API, local avatar/CSS, full-text search and Markdown/JSON exports');
  checks.push('Installed draw.io component renders its SVG and exact source download; agent exports retain the description without binary payloads');
  checks.push('Installed static 404 page honors YAML copy and mounted recovery links, returns 404, and stays out of search');
  checks.push('Installed ten-level navigation renders the deepest MDX page with one current link; every parent and child has a collision-free .md export');

  run(site, 'npm', ['run', 'docsy', '--', 'create', join(workspace, 'second'), '--yes', '--no-install']);
  assert.equal(JSON.parse(read(join(workspace, 'second/.docsy/template.json'))).templateVersion, artifact.version);
  checks.push('A generated site can generate a second site without the original checkout or losing its template version');

  config.access.mode = 'locked'; config.agent.query = true;
  config.access.rules = [{ pattern: '/guides/private', tiers: ['enterprise'] }, { pattern: `/guides/${nestedLeaf}`, tiers: ['enterprise'] }];
  write(configPath, dump(config));
  run(site, 'npm', ['run', 'build']);
  server = await serve();
  try {
    const auth = { 'x-docsy-tiers': 'enterprise' };
    assert.equal((await fetch(`${server.base}/guides/private`, { redirect: 'manual' })).status, 302);
    assert.equal((await fetch(`${server.base}/agent/pages/guides/private.json`)).status, 404);
    assert.equal((await fetch(`${server.base}/format-md/guides/private`)).status, 401);
    assert.equal((await fetch(`${server.base}/format-md/guides/${nestedLeaf}.md`)).status, 401);
    assert.equal((await fetch(`${server.base}/agent/pages/guides/${nestedLeaf}.json`)).status, 404);
    assert.match(await (await fetch(`${server.base}/format-md/guides/${nestedLeaf}.md`, { headers: auth })).text(), new RegExp(nestedSignal));
    assert.doesNotMatch(await (await fetch(`${server.base}/format-md/index.md`)).text(), new RegExp(nestedLeaf));
    assert.doesNotMatch(await (await fetch(`${server.base}/search-index.json`)).text(), new RegExp(privateSignal));
    const allowed = await fetch(`${server.base}/agent/pages/guides/private.json`, { headers: auth }); assert.equal(allowed.status, 200); assert.match((await allowed.json()).markdown, new RegExp(privateSignal));
    assert.equal((await (await fetch(`${server.base}/agent/query.json?q=${privateSignal}`)).json()).count, 0);
    assert.ok((await (await fetch(`${server.base}/agent/query.json?q=${privateSignal}`, { headers: auth })).json()).count > 0);
    const missing = await fetch(`${server.base}/api/package-missing`, { redirect: 'manual' });
    assert.equal(missing.status, 404); const missingHtml = await missing.text();
    assert.match(missingHtml, /Package 404 recovery/); assert.doesNotMatch(missingHtml, new RegExp(privateSignal));
  } finally { await server.stop(); }
  checks.push('Actual standalone server: anonymous HTML/Markdown/JSON/search denied or filtered; authorized article and live agent query succeed');
  checks.push('Installed standalone 404 page returns 404 without exposing protected article content');
  checks.push('Installed nested canonical Markdown and JSON exports enforce the same runtime tiers and filter locked links from the overview');
  checks.push('Installed sidebar renders local pack icons and a custom mask, without an icon API or font service');
  assert.equal(sha256(tarball), artifact.sha256, 'Package changed during testing');
  const report = { result: 'passed', commit: process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), artifact, checks, node: process.version, npm: run(consumer, 'npm', ['--version']).trim() };
  write(join(output, 'package-test.json'), JSON.stringify(report, null, 2) + '\n');
  passed = true; console.log(JSON.stringify(report, null, 2));
} finally {
  if (passed) rmSync(workspace, { recursive: true, force: true });
  else console.error(`Failed package-test workspace preserved at ${workspace}`);
}
