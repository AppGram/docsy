import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { dump } from 'js-yaml';
import { setTimeout as delay } from 'node:timers/promises';

const repo = process.cwd();
const write = (root: string, path: string, value: string) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), value); };
const read = (root: string, path: string) => readFileSync(join(root, path), 'utf8');
const command = (root: string, ...args: string[]) => execFileSync(process.execPath, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, DOCSY_CONFIG: 'docsy.config.yaml' }, timeout: 90_000 });

function site() {
  const parent = mkdtempSync(join(tmpdir(), 'docsy-integration-'));
  const root = join(parent, 'site');
  command(repo, 'scripts/create-docsy.mjs', root, '--yes', '--no-install', '--name', 'Test Docs');
  symlinkSync(join(repo, 'node_modules'), join(root, 'node_modules'), 'dir');
  const config: any = {
    site: { name: 'Test Docs', title: 'Test Docs', description: 'Integration docs', origin: 'https://docs.example.test', basePath: '/docs', homeUrl: '/docs/', logo: 'assets/docsy-logo.png', logoDark: 'assets/docsy-logo-dark.png' },
    home: { title: 'Integration docs', description: 'Versions, articles and agent retrieval', primaryAction: { label: 'Read', href: '/guides/guide' }, translations: { fr: { title: 'Documentation française' } } },
    versions: { default: 'current', items: [{ id: 'current', label: 'Current' }, { id: 'v1', label: 'Version 1', status: 'deprecated' }] },
    localization: { defaultLocale: 'en', fallback: true, locales: [{ code: 'en', label: 'English' }, { code: 'fr', label: 'Français' }, { code: 'ar', label: 'العربية', dir: 'rtl' }], messages: { fr: { language: 'Langue', guides: 'Guides', onThisPage: 'Sur cette page', searchLabel: 'Rechercher' } } },
    content: { snippets: { shared: 'content/shared.md' }, articles: [
      { slug: 'guide', title: 'Guide', source: 'content/guide.md' },
      { slug: 'guide', title: 'Guide français', locale: 'fr', source: 'content/fr.md' },
      { slug: 'guide', title: 'Old guide', version: 'v1', source: 'content/v1.md' },
      { slug: 'private', title: 'Restricted guide', source: 'content/private.md' },
    ] },
    navigation: [{ title: 'Guides', items: [{ title: 'Guide', titles: { fr: 'Guide français' }, href: '/guides/guide' }, { title: 'Restricted guide', href: '/guides/private' }, { title: 'API', href: '/api/widgets' }, { title: 'SDK', href: '/widget-sdk' }] }],
    ingestion: { openapi: { source: 'sources/api.yaml', apiBaseUrl: 'https://api.example.test', versions: { v1: 'sources/v1.yaml' }, sections: [{ section: 'widgets', title: 'Widgets', description: 'Widgets API', paths: ['/widgets'] }] }, sdks: [{ id: 'widget', slug: 'widget-sdk', adapter: 'typedoc-lite', source: 'sources/sdk.json', versions: { v1: 'sources/sdk-v1.json' }, name: 'Widget SDK', language: 'typescript', install: 'npm install widget', overview: 'Widget API client', quickstart: { code: 'client.get("quickstartneedle");', language: 'typescript' } }] },
    access: { mode: 'open', tiers: { pro: { label: 'Pro' } }, rules: [{ pattern: '/guides/private', tiers: ['pro'] }] },
    agent: { enabled: true, query: false },
  };
  write(root, 'content/guide.md', '# Guide body\n\nThe elusive platypusword only appears inside a paragraph.\n\n## Details\n\n:::note[Read carefully]\n::include{src="shared"}\n:::\n\n::::tabs{sync="runtime"}\n:::tab[Node]\nNode instructions.\n:::\n:::tab[Python]\nPython instructions.\n:::\n::::\n');
  write(root, 'content/fr.md', '# Bonjour\n\nInstructions françaises.\n');
  write(root, 'content/v1.md', '# Old behavior\n\nUse legacyfirefly for version one.\n');
  write(root, 'content/private.md', '# Restricted\n\nclassifiedsecretword must never leak to public retrieval.\n');
  write(root, 'content/shared.md', 'Shared reusable instructions.\n');
  const spec = { openapi: '3.1.0', info: { title: 'Widgets', version: '2' }, paths: { '/widgets': { get: { responses: { 200: { description: 'OK' } } } } } };
  write(root, 'sources/api.yaml', dump(spec)); write(root, 'sources/v1.yaml', dump({ ...spec, info: { title: 'Widgets', version: '1' } }));
  const sdk = (summary: string) => ({ modules: [{ types: [{ kind: 'class', name: 'WidgetClient', description: { summary } }] }], navigation: { categories: [{ title: 'Classes', items: ['WidgetClient'] }] } });
  write(root, 'sources/sdk.json', JSON.stringify(sdk('Modern client'))); write(root, 'sources/sdk-v1.json', JSON.stringify(sdk('Legacy SDK client')));
  const save = () => write(root, 'docsy.config.yaml', dump(config)); save();
  return { parent, root, config, save };
}

const freePort = () => new Promise<number>((resolve, reject) => { const server = createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const port = (server.address() as { port: number }).port; server.close(() => resolve(port)); }); });
async function serve(root: string) {
  const port = await freePort();
  const child = spawn(process.execPath, ['scripts/start.mjs'], { cwd: root, env: { ...process.env, DOCSY_CONFIG: 'docsy.config.yaml', HOST: '127.0.0.1', PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; child.stdout.on('data', (chunk) => { logs = (logs + chunk).slice(-12000); }); child.stderr.on('data', (chunk) => { logs = (logs + chunk).slice(-12000); });
  const base = `http://127.0.0.1:${port}/docs`;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`Server exited: ${logs}`);
    try { const response = await fetch(base); if (response.status < 500) return { base, stop: async () => { child.kill('SIGTERM'); await new Promise<void>((resolve) => { child.once('exit', () => resolve()); if (child.exitCode !== null) resolve(); }); } }; } catch {}
    await delay(100);
  }
  child.kill('SIGTERM'); throw new Error(`Server did not start: ${logs}`);
}

test('generated template builds static variants/exports and Node APIs without permission leaks', { timeout: 180_000 }, async () => {
  const fixture = site(); const { root, config, save } = fixture;
  try {
    command(root, 'scripts/docsy.mjs', 'build');
    const fr = read(root, 'release/docs/versions/current/fr/guides/guide/index.html');
    assert.match(fr, /lang="fr"/); assert.match(fr, /Guide français/); assert.match(fr, /Rechercher/); assert.match(fr, /hreflang="fr"/);
    const old = read(root, 'release/docs/versions/v1/fr/guides/guide/index.html');
    assert.match(old, /legacyfirefly/); assert.ok(!old.includes('Instructions françaises')); assert.match(old, /default language/);
    assert.match(read(root, 'release/docs/versions/current/ar/guides/guide/index.html'), /dir="rtl"/);
    assert.match(read(root, 'release/docs/guides/guide/index.html'), /docsy-tabs/);
    assert.match(read(root, 'release/docs/versions/v1/en/widget-sdk/index.html'), /Legacy SDK client/);
    assert.match(read(root, 'release/docs/widget-sdk/index.html'), /quickstartneedle/);
    assert.match(read(root, 'release/docs/format-md/widget-sdk'), /## Quickstart/);
    assert.match(read(root, 'release/docs/versions/v1/en/api/widgets/index.html'), /v1/);
    const index = JSON.parse(read(root, 'release/docs/search-index.json'));
    assert.ok(index.entries.some((entry: any) => entry.body.includes('platypusword')));
    assert.ok(index.entries.some((entry: any) => entry.id === 'current:fr:home' && entry.title === 'Documentation française'));
    assert.equal(JSON.parse(read(root, 'release/docs/agent/pages/versions/current/fr/index.json')).title, 'Documentation française');
    const page = JSON.parse(read(root, 'release/docs/agent/pages/versions/v1/fr/guides/guide.json'));
    assert.equal(page.version, 'v1'); assert.equal(page.locale, 'fr'); assert.equal(page.contentLocale, 'en'); assert.equal(page.isFallback, true); assert.ok(page.markdown.includes('legacyfirefly'));
    assert.ok(!read(root, 'release/docs/format-md/guides/guide').includes(':::'));
    assert.match(read(root, 'release/docs/llms.txt'), /agent\/index.json/);
    assert.equal(JSON.parse(read(root, 'release/docs/agent/query.json')).queryAvailable, false);

    config.localization.fallback = false; save(); command(root, 'scripts/docsy.mjs', 'build');
    assert.ok(!existsSync(join(root, 'release/docs/versions/current/ar/guides/guide/index.html')));
    assert.ok(!existsSync(join(root, 'release/docs/versions/v1/fr/guides/guide/index.html')));
    assert.ok(existsSync(join(root, 'release/docs/versions/current/ar/index.html')));
    config.localization.fallback = true; save();

    // A malformed source and broken links must stop the exact generated CLI.
    write(root, 'content/guide.md', '## Known\n\n[missing](../absent)\n');
    assert.throws(() => command(root, 'scripts/docsy.mjs', 'validate'), /broken link/);
    write(root, 'content/guide.md', '## Known\n\n[missing](#absent)\n');
    assert.throws(() => command(root, 'scripts/docsy.mjs', 'validate'), /broken anchor/);
    write(root, 'content/guide.md', '## Details\n\nThe elusive platypusword appears in the paragraph.\n');
    write(root, 'sources/api.yaml', 'not: an API');
    assert.throws(() => command(root, 'scripts/docsy.mjs', 'validate'), /Could not ingest/);
    write(root, 'sources/api.yaml', dump({ openapi: '3.1.0', info: { title: 'Widgets', version: '2' }, paths: { '/widgets': { get: { responses: { 200: { description: 'OK' } } } } } }));

    config.access.mode = 'locked'; config.agent.query = true; save();
    command(root, 'scripts/docsy.mjs', 'build');
    assert.ok(existsSync(join(root, 'dist/server/entry.mjs')));
    assert.ok(!existsSync(join(root, 'release/docs/agent/index.json')));
    let server = await serve(root);
    try {
      const auth = { 'x-docsy-tiers': 'pro' };
      for (const path of ['/search-index.json', '/agent/index.json', '/llms.txt', '/llms-full.txt']) {
        const response = await fetch(`${server.base}${path}`);
        assert.match(response.headers.get('cache-control') ?? '', /private.*no-store/);
        const body = await response.text();
        assert.ok(!body.includes('classifiedsecretword'), `Leak in ${path}`);
        assert.ok(!body.includes('Restricted guide'), `Private metadata leak in ${path}`);
      }
      let response = await fetch(`${server.base}/agent/query.json?q=classifiedsecretword`);
      assert.equal((await response.json()).count, 0);
      response = await fetch(`${server.base}/agent/query.json?q=classifiedsecretword`, { headers: auth });
      assert.equal((await response.json()).count, 1);
      response = await fetch(`${server.base}/agent/query.json?q=platypusword&locale=en`); assert.ok((await response.json()).count > 0);
      response = await fetch(`${server.base}/agent/query.json?q=legacyfirefly&version=v1&locale=fr`); assert.ok((await response.json()).count > 0);
      for (const key of ['guides/private', 'versions/v1/fr/guides/private']) {
        response = await fetch(`${server.base}/agent/pages/${key}.json`); assert.equal(response.status, 404);
        response = await fetch(`${server.base}/agent/pages/${key}.json`, { headers: auth }); assert.equal(response.status, 200); assert.ok((await response.json()).markdown.includes('classifiedsecretword'));
        response = await fetch(`${server.base}/format-md/${key}`); assert.equal(response.status, 401);
      }
      response = await fetch(`${server.base}/guides/private`, { redirect: 'manual' }); assert.equal(response.status, 302);
      response = await fetch(`${server.base}/guides/private`, { headers: { accept: 'text/markdown' } }); assert.equal(response.status, 401);
      response = await fetch(`${server.base}/guides/guide`, { headers: { accept: 'text/markdown' } }); assert.match(response.headers.get('content-type')!, /text\/markdown/); assert.match(await response.text(), /platypusword/);
      response = await fetch(`${server.base}/agent/query.json?q=test&limit=999`); assert.equal(response.status, 400);
      response = await fetch(`${server.base}/agent/pages/not-a-document.json`); assert.equal(response.status, 404);
    } finally { await server.stop(); }

    // agent.query also enables the runtime with public docs, independently of lock mode.
    config.access.mode = 'open'; save(); command(root, 'scripts/docsy.mjs', 'build');
    server = await serve(root);
    try {
      const response = await fetch(`${server.base}/agent/query.json?q=platypusword`);
      assert.equal(response.status, 200); assert.ok((await response.json()).count > 0);
      const markdown = await fetch(`${server.base}/guides/guide`, { headers: { accept: 'text/markdown' } }); assert.match(markdown.headers.get('content-type')!, /text\/markdown/);
      assert.match(markdown.headers.get('vary')!, /Accept/);
      const html = await fetch(`${server.base}/guides/guide`, { headers: { accept: 'text/html' } });
      assert.match(html.headers.get('content-type')!, /text\/html/); assert.match(html.headers.get('vary')!, /Accept/);
    } finally { await server.stop(); }
  } finally { rmSync(fixture.parent, { recursive: true, force: true }); }
});
