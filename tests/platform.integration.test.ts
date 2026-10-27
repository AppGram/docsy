import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { dump } from 'js-yaml';
import { parse } from 'parse5';
import { setTimeout as delay } from 'node:timers/promises';

const repo = process.cwd();
const runtime = process.env.DOCSY_TEST_RUNTIME || 'node';
assert.ok(['node', 'bun'].includes(runtime), 'DOCSY_TEST_RUNTIME must be node or bun');
const runtimeExecutable = runtime === 'bun' ? 'bun' : process.execPath;
const nestedSlugs = Array.from({ length: 10 }, (_, index) => `nested/${Array.from({ length: index + 1 }, (_, level) => `level-${level + 1}`).join('/')}`);
const nestedLeaf = nestedSlugs.at(-1)!;
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
    notFound: { title: 'The fixture page is missing.', description: 'Try another fixture page.', links: [{ label: 'Guide', href: '/guides/guide' }], translations: { fr: { title: 'Page introuvable', primaryActionLabel: 'Accueil' } } },
    versions: { default: 'current', items: [{ id: 'current', label: 'Current' }, { id: 'v1', label: 'Version 1', status: 'deprecated' }] },
    localization: { defaultLocale: 'en', fallback: true, locales: [{ code: 'en', label: 'English' }, { code: 'fr', label: 'Français' }, { code: 'ar', label: 'العربية', dir: 'rtl' }], messages: { fr: { language: 'Langue', guides: 'Guides', onThisPage: 'Sur cette page', searchLabel: 'Rechercher', unknownAuthor: 'Auteur inconnu' } } },
    content: { diagrams: { protected: { format: 'plantuml', image: 'content/private.svg', source: 'content/private.puml', alt: 'classifieddiagramneedle UML review' } }, snippets: { shared: 'content/shared.md' }, articles: [
      { slug: 'guide', title: 'Guide', source: 'content/guide.md', authors: ['writer'], contributors: ['agent'], reviewedBy: ['writer'], updatedAt: '2026-10-19', reviewedAt: '2026-10-19', provenance: { agent: 'agent', model: 'fixture-model', referenceUrl: 'https://github.com/example/docs/pull/1' } },
      { slug: 'guide', title: 'Guide français', locale: 'fr', source: 'content/fr.md', authors: ['writer'], updatedAt: '2026-10-18' },
      { slug: 'guide', title: 'Old guide', version: 'v1', source: 'content/v1.md', editUrl: false },
      { slug: 'private', title: 'Restricted guide', source: 'content/private.mdx', authors: ['secret'], editUrl: false },
      { slug: 'native', title: 'Native MDX', source: 'content/native.mdx' },
    ] },
    sidebar: { iconSize: 18 },
    navigation: [{ title: 'Guides', icon: 'lucide:book-open', items: [
      { title: 'Guide', titles: { fr: 'Guide français' }, href: '/guides/guide', icon: 'lucide:rocket', items: [{ title: 'Guide details', href: '/guides/guide#details', icon: 'tabler:list-details' }] },
      { title: 'Restricted guide', href: '/guides/private', icon: false },
      { title: 'API', href: '/api/widgets', icon: { pack: 'tabler', name: 'api' } },
      { title: 'SDK', href: '/widget-sdk', icon: { src: 'assets/authors/writer.svg', darkSrc: 'assets/authors/docsy-agent.svg' } },
    ] }],
    ingestion: { openapi: { source: 'sources/api.yaml', apiBaseUrl: 'https://api.example.test', versions: { v1: 'sources/v1.yaml' }, sections: [{ section: 'widgets', title: 'Widgets', description: 'Widgets API', paths: ['/widgets'] }] }, sdks: [{ id: 'widget', slug: 'widget-sdk', adapter: 'typedoc-lite', source: 'sources/sdk.json', versions: { v1: 'sources/sdk-v1.json' }, name: 'Widget SDK', language: 'typescript', install: 'npm install widget', overview: 'Widget API client', quickstart: { code: 'client.get("quickstartneedle");', language: 'typescript' } }] },
    access: { mode: 'open', tiers: { pro: { label: 'Pro' } }, rules: [{ pattern: '/guides/private', tiers: ['pro'] }] },
    agent: { enabled: true, query: false },
    authors: { writer: { name: 'Fixture Writer', github: 'fixture-writer', avatar: 'assets/authors/writer.svg' }, agent: { name: 'Fixture Coding Agent', kind: 'agent', provider: 'Fixture provider' }, secret: { name: 'PrivateAuthorIdentity' } },
    reader: { defaultAuthorAvatar: 'assets/authors/docsy-agent.svg', unknownAuthorAvatar: 'assets/authors/unknown.svg', editUrl: 'https://github.com/example/docs/edit/{version}/{locale}/{source}', reportUrl: 'https://github.com/example/docs/issues/new' },
    redirects: { '/old-guide': '/guides/guide', '/old-private': '/guides/private' },
  };
  write(root, 'content/guide.md', '# Guide body\n\nThe elusive platypusword only appears inside a paragraph.\n\n## Details\n\n:::note[Read carefully]\n::include{src="shared"}\n:::\n\n::::tabs{sync="runtime"}\n:::tab[Node]\nNode instructions.\n:::\n:::tab[Python]\nPython instructions.\n:::\n::::\n');
  write(root, 'content/fr.md', '# Bonjour\n\nInstructions françaises.\n\n## Details\n\nDétails du guide.\n');
  write(root, 'content/v1.md', '# Old behavior\n\nUse legacyfirefly for version one.\n\n## Details\n\nLegacy details.\n');
  write(root, 'content/private.mdx', '## Restricted\n\n<Warning>classifiedsecretword must never leak to public retrieval.</Warning>\n\n```mermaid Private sequence\nsequenceDiagram\nReader->>Docsy: classifieddiagramneedle\n```\n\n<PlantUml src="protected" />\n');
  write(root, 'content/private.svg', read(repo, 'content/diagrams/article-review.svg'));
  write(root, 'content/private.puml', '@startuml\nReader -> Docsy: classifieddiagramneedle\n@enduml\n');
  write(root, 'content/native.mdx', '## Native components\n\n<Tabs>\n<Tab title="Node">mdxquokkaneedle stays searchable.</Tab>\n<Tab title="Bun">Bun works too.</Tab>\n</Tabs>\n\n```ts\nconst native = true;\n```');
  write(root, 'content/shared.md', 'Shared reusable instructions.\n');
  write(root, 'public/assets/sample.mp4', '0123456789');
  write(root, 'public/assets/sample.vtt', 'WEBVTT\n');
  write(root, 'public/assets/authors/writer.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#5188ff"/></svg>');
  write(root, 'sources/upstream-code.ts', 'import { UnavailableUpstreamType } from "./not-shipped.js";\n// Ingested source snapshot, not executable portal code.\n');
  const spec = { openapi: '3.1.0', info: { title: 'Widgets', version: '2' }, paths: { '/widgets': { get: { responses: { 200: { description: 'OK' } } } } } };
  write(root, 'sources/api.yaml', dump(spec)); write(root, 'sources/v1.yaml', dump({ ...spec, info: { title: 'Widgets', version: '1' } }));
  const sdk = (summary: string) => ({ modules: [{ types: [{ kind: 'class', name: 'WidgetClient', description: { summary } }] }], navigation: { categories: [{ title: 'Classes', items: ['WidgetClient'] }] } });
  write(root, 'sources/sdk.json', JSON.stringify(sdk('Modern client'))); write(root, 'sources/sdk-v1.json', JSON.stringify(sdk('Legacy SDK client')));
  let branch: any;
  for (let i = nestedSlugs.length - 1; i >= 0; i--) {
    const slug = nestedSlugs[i], source = `content/${slug}/index.${i === 9 ? 'mdx' : 'md'}`;
    config.content.articles.push({ slug, source, title: `Nested level ${i + 1}` });
    write(root, source, `## Deep section\n\n${i === 9 ? '<Note>nestedquokkaproof reaches the deepest MDX page.</Note>' : 'A nested Markdown article.'}\n`);
    branch = { title: `Nested level ${i + 1}`, titles: { fr: `Niveau ${i + 1}` }, href: `/guides/${slug}`, icon: 'lucide:book-open', ...(branch ? { items: [branch] } : {}) };
  }
  config.navigation[0].items.push(branch);
  config.content.articles.push({ slug: nestedLeaf, version: 'v1', source: 'content/nested-v1.md', title: 'Legacy nested page' });
  write(root, 'content/nested-v1.md', '## Deep section\n\nnestedlegacyproof uses the version-one contract.\n');
  config.access.rules.push({ pattern: `/guides/${nestedLeaf}`, tiers: ['pro'] });
  const save = () => write(root, 'docsy.config.yaml', dump(config)); save();
  return { parent, root, config, save };
}

const freePort = () => new Promise<number>((resolve, reject) => { const server = createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const port = (server.address() as { port: number }).port; server.close(() => resolve(port)); }); });
async function serve(root: string) {
  const port = await freePort();
  const child = spawn(runtimeExecutable, ['scripts/start.mjs'], { cwd: root, env: { ...process.env, DOCSY_CONFIG: 'docsy.config.yaml', HOST: '127.0.0.1', PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; child.stdout.on('data', (chunk) => { logs = (logs + chunk).slice(-12000); }); child.stderr.on('data', (chunk) => { logs = (logs + chunk).slice(-12000); });
  const base = `http://127.0.0.1:${port}/docs`;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`Server exited: ${logs}`);
    try { const response = await fetch(base); if (response.status < 500) return { base, stop: async () => { child.kill('SIGTERM'); await new Promise<void>((resolve) => { child.once('exit', () => resolve()); if (child.exitCode !== null) resolve(); }); } }; } catch {}
    await delay(100);
  }
  child.kill('SIGTERM'); throw new Error(`Server did not start: ${logs}`);
}

test(`generated template serves static variants and permission-aware APIs on ${runtime}`, { timeout: 180_000 }, async () => {
  const fixture = site(); const { root, config, save } = fixture;
  try {
    command(root, 'scripts/docsy.mjs', 'build');
    const generated = JSON.parse(read(root, 'package.json'));
    assert.equal(generated.scripts.start, 'node scripts/start.mjs');
    assert.equal(generated.scripts['start:bun'], 'bun scripts/start.mjs');
    assert.ok(existsSync(join(root, 'Dockerfile.bun')));
    const staticServer = await serve(root);
    try {
      const deep = await fetch(`${staticServer.base}/guides/${nestedLeaf}/`);
      assert.equal(deep.status, 200);
      const deepHtml = await deep.text(); assert.match(deepHtml, /nestedquokkaproof/);
      assert.match(deepHtml, /data-sidebar-depth="9"/);
      const sidebar = deepHtml.match(/<aside[^>]*id="docs-sidebar"[^>]*>([\s\S]*?)<\/aside>/)![1];
      assert.equal((sidebar.match(/aria-current="page"/g) ?? []).length, 1);
      assert.equal((sidebar.match(/<details[^>]*\bopen(?:\s|=|>)/g) ?? []).length, 9);
      for (const slug of nestedSlugs) {
        const markdown = await fetch(`${staticServer.base}/format-md/guides/${slug}.md`);
        assert.equal(markdown.status, 200); assert.match(await markdown.text(), /Deep section/);
      }
      assert.match(deepHtml, new RegExp(`href="/docs/format-md/guides/${nestedLeaf}\\.md"`));
      assert.match(await (await fetch(`${staticServer.base}/format-md/index`)).text(), new RegExp(nestedLeaf));
      const translated = await (await fetch(`${staticServer.base}/versions/current/fr/guides/${nestedLeaf}/`)).text();
      assert.match(translated, /Niveau 10/); assert.match(translated, /aria-current="page"/);
      const legacy = await (await fetch(`${staticServer.base}/agent/pages/versions/v1/fr/guides/${nestedLeaf}.json`)).json();
      assert.equal(legacy.version, 'v1'); assert.equal(legacy.isFallback, true); assert.match(legacy.markdown, /nestedlegacyproof/);
      const response = await fetch(`${staticServer.base}/guides/guide`);
      assert.equal(response.status, 200);
      const body = await response.text();
      assert.match(body, /<dialog[^>]*class="docs-media-viewer"[^>]*data-images="true"[^>]*data-videos="true"/);
      const media = await fetch(`${staticServer.base}/assets/sample.mp4`, { headers: { Range: 'bytes=2-5' } });
      assert.equal(media.status, 206); assert.equal(media.headers.get('content-type'), 'video/mp4');
      assert.equal(media.headers.get('content-range'), 'bytes 2-5/10'); assert.equal(await media.text(), '2345');
      assert.equal((await fetch(`${staticServer.base}/assets/sample.mp4`, { headers: { Range: 'bytes=10-' } })).status, 416);
      const head = await fetch(`${staticServer.base}/assets/sample.mp4`, { method: 'HEAD' });
      assert.equal(head.headers.get('content-length'), '10'); assert.equal(await head.text(), '');
      assert.match((await fetch(`${staticServer.base}/assets/sample.vtt`)).headers.get('content-type')!, /text\/vtt/);
      assert.match(body, /platypusword/);
      assert.match(body, /data-sidebar-icon="lucide:book-open"/);
      assert.match(body, /data-sidebar-icon="lucide:rocket"/);
      assert.match(body, /data-sidebar-icon="tabler:api"/);
      assert.match(body, /data-sidebar-icon="tabler:list-details"/);
      assert.match(body, /--sidebar-icon-size:18px/);
      assert.match(body, /class="sidebar-icon-dark"[^>]*src="\/docs\/assets\/authors\/docsy-agent.svg"/);
      assert.match(body, /--sidebar-icon-light:url\(&quot;data:image\/svg\+xml/);
      assert.doesNotMatch(body, /api\.iconify\.design|fonts\.googleapis|iconify-icon/);
      assert.match(body, /https:\/\/github.com\/example\/docs\/edit\/current\/en\/content\/guide.md/);
      assert.match(body, /Report a problem/);
      assert.match(body, /article-edit-button/); assert.match(body, /Fixture Writer/); assert.match(body, /Fixture Coding Agent/);
      const header = body.match(/<header class="article-header"[^>]*>([\s\S]*?)<\/header>/)?.[1];
      const footer = body.match(/<div class="article-source-actions"[^>]*>([\s\S]*?)<\/div>/)?.[1];
      assert.ok(header); assert.doesNotMatch(header, /article-edit-button/);
      assert.ok(footer); assert.match(footer, /article-edit-button/); assert.match(footer, /data-edit-style="subtle"/);
      assert.equal((body.match(/class="article-edit-button"/g) ?? []).length, 1);
      assert.match(body, /datetime="2026-10-19"/); assert.match(body, /https:\/\/github.com\/fixture-writer/);
      assert.match(body, /article:author/); assert.match(body, /TechArticle/); assert.match(body, /fixture-model/);
      assert.doesNotMatch(body, /avatars.githubusercontent.com/);
      assert.match(body, /src="\/docs\/assets\/authors\/writer.svg"/);
      assert.match(body, /src="\/docs\/assets\/authors\/docsy-agent.svg"/);
      assert.doesNotMatch(body, /class="article-author-placeholder"/);
      assert.match(body, /referrerpolicy="no-referrer"/);
      assert.equal((await fetch(`${staticServer.base}/assets/authors/writer.svg`)).status, 200);
      const redirect = await fetch(`${staticServer.base}/old-guide`);
      assert.equal(redirect.status, 200);
      assert.match(await redirect.text(), /\/docs\/guides\/guide/);
      const markdown = await fetch(`${staticServer.base}/format-md/guides/guide`);
      assert.match(markdown.headers.get('content-type')!, /text\/markdown/);
      assert.match(await markdown.text(), /platypusword/);
      const missing = await fetch(`${staticServer.base}/guides/not-a-document?secret=never-render-this`);
      assert.equal(missing.status, 404); assert.match(missing.headers.get('content-type')!, /text\/html/);
      const missingHtml = await missing.text();
      assert.match(missingHtml, /The fixture page is missing/); assert.match(missingHtml, /noindex/);
      assert.match(missingHtml, /href="\/docs"/); assert.match(missingHtml, /href="\/docs\/guides\/guide"/);
      assert.match(missingHtml, /data-not-found-search/); assert.doesNotMatch(missingHtml, /id="docs-sidebar"|never-render-this/);
      const missingHead = await fetch(`${staticServer.base}/not-a-document`, { method: 'HEAD' });
      assert.equal(missingHead.status, 404); assert.equal(await missingHead.text(), '');
      const missingAsset = await fetch(`${staticServer.base}/assets/no-file.png`);
      assert.equal(missingAsset.status, 404); assert.doesNotMatch(await missingAsset.text(), /not-found-title/);
      const mdx = await fetch(`${staticServer.base}/guides/native`);
      assert.equal(mdx.status, 200); const unknown = await mdx.text(); assert.match(unknown, /docsy-tabs/);
      assert.match(unknown, /Unknown author/); assert.match(unknown, /class="article-author-placeholder"/);
      assert.match(unknown, /--author-placeholder:url\([^)]*\/docs\/assets\/authors\/unknown.svg/);
      assert.equal((await fetch(`${staticServer.base}/assets/authors/unknown.svg`)).status, 200);
      const unknownJson = await fetch(`${staticServer.base}/agent/pages/guides/native.json`);
      assert.deepEqual((await unknownJson.json()).authorship.authors, []);
    } finally { await staticServer.stop(); }
    const fr = read(root, 'release/docs/versions/current/fr/guides/guide/index.html');
    assert.equal(read(root, 'release/404.html'), read(root, 'release/docs/404.html'));
    assert.match(fr, /lang="fr"/); assert.match(fr, /Guide français/); assert.match(fr, /Rechercher/); assert.match(fr, /hreflang="fr"/);
    assert.match(fr, /data-sidebar-icon="lucide:rocket"/);
    const old = read(root, 'release/docs/versions/v1/fr/guides/guide/index.html');
    assert.match(old, /legacyfirefly/); assert.ok(!old.includes('Instructions françaises')); assert.match(old, /default language/);
    assert.doesNotMatch(old, /class="article-edit-button"|Fixture Writer/);
    assert.match(old, /Auteur inconnu/); assert.match(old, /--author-placeholder:url\([^)]*\/docs\/assets\/authors\/unknown.svg/);
    assert.match(read(root, 'release/docs/versions/current/ar/guides/guide/index.html'), /dir="rtl"/);
    assert.match(read(root, 'release/docs/versions/current/ar/guides/guide/index.html'), /data-sidebar-icon="lucide:rocket"/);
    assert.match(read(root, 'release/docs/guides/guide/index.html'), /docsy-tabs/);
    assert.match(read(root, 'release/docs/versions/v1/en/widget-sdk/index.html'), /Legacy SDK client/);
    assert.match(read(root, 'release/docs/widget-sdk/index.html'), /quickstartneedle/);
    assert.match(read(root, 'release/docs/format-md/widget-sdk'), /## Quickstart/);
    assert.match(read(root, 'release/docs/versions/v1/en/api/widgets/index.html'), /v1/);
    const index = JSON.parse(read(root, 'release/docs/search-index.json'));
    assert.ok(index.entries.some((entry: any) => entry.url.split('#')[0].endsWith(`/guides/${nestedLeaf}`) && entry.body.includes('nestedquokkaproof')));
    assert.ok(index.entries.some((entry: any) => entry.body.includes('platypusword')));
    assert.ok(index.entries.some((entry: any) => entry.body.includes('mdxquokkaneedle')));
    assert.match(read(root, 'release/docs/format-md/guides/native'), /mdxquokkaneedle/);
    assert.ok(!read(root, 'release/docs/format-md/guides/native').includes('<Tab'));
    assert.ok(index.entries.some((entry: any) => entry.id === 'current:fr:home' && entry.title === 'Documentation française'));
    assert.equal(JSON.parse(read(root, 'release/docs/agent/pages/versions/current/fr/index.json')).title, 'Documentation française');
    const page = JSON.parse(read(root, 'release/docs/agent/pages/versions/v1/fr/guides/guide.json'));
    assert.equal(page.version, 'v1'); assert.equal(page.locale, 'fr'); assert.equal(page.contentLocale, 'en'); assert.equal(page.isFallback, true); assert.ok(page.markdown.includes('legacyfirefly'));
    assert.ok(!read(root, 'release/docs/format-md/guides/guide').includes(':::'));
    assert.match(read(root, 'release/docs/llms.txt'), /agent\/index.json/);
    assert.equal(JSON.parse(read(root, 'release/docs/agent/query.json')).queryAvailable, false);

    config.content.media = { enabled: false };
    config.notFound.layout = 'docs'; config.notFound.showCode = false; config.notFound.showSearch = false;
    config.notFound.image = { src: 'assets/authors/writer.svg', alt: 'A fixture illustration' };
    config.reader.showByline = false;
    config.reader.editPlacement = 'header'; config.reader.editStyle = 'button';
    config.authors.writer.name = 'Fixture Writer </script><script data-injected>bad()</script>';
    config.localization.fallback = false; save(); command(root, 'scripts/docsy.mjs', 'build');
    const custom404 = read(root, 'dist/404.html');
    assert.match(custom404, /id="docs-sidebar"/); assert.match(custom404, /data-not-found-layout="docs"/);
    assert.match(custom404, /class="not-found-image"[^>]*src="\/docs\/assets\/authors\/writer.svg"/);
    assert.doesNotMatch(custom404, /<p[^>]*class="not-found-code"|<button[^>]*data-not-found-search/);
    assert.ok(!read(root, 'release/docs/guides/guide/index.html').includes('<dialog class="docs-media-viewer"'));
    const hiddenCredits = read(root, 'release/docs/guides/guide/index.html');
    assert.ok(!hiddenCredits.includes('<div class="article-credits"'));
    assert.ok(!read(root, 'release/docs/guides/native/index.html').includes('<div class="article-credits"'));
    const scriptNodes: any[] = [];
    const inspect = (node: any) => { if (node.tagName === 'script') scriptNodes.push(node); node.childNodes?.forEach(inspect); };
    inspect(parse(hiddenCredits));
    assert.ok(!scriptNodes.some((node) => node.attrs?.some((attribute: any) => attribute.name === 'data-injected')), 'Author metadata must not create script elements');
    assert.match(hiddenCredits, /article-edit-button/); assert.ok(hiddenCredits.includes('\\u003c/script>'));
    const headerEdit = hiddenCredits.match(/<header class="article-header"[^>]*>([\s\S]*?)<\/header>/)?.[1];
    assert.ok(headerEdit); assert.match(headerEdit, /article-edit-button/); assert.match(headerEdit, /data-edit-style="button"/);
    assert.equal((hiddenCredits.match(/class="article-edit-button"/g) ?? []).length, 1);
    assert.doesNotMatch(hiddenCredits.match(/<div class="article-source-actions"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '', /article-edit-button/);
    assert.ok(!existsSync(join(root, 'release/docs/versions/current/ar/guides/guide/index.html')));
    assert.ok(!existsSync(join(root, 'release/docs/versions/v1/fr/guides/guide/index.html')));
    assert.ok(existsSync(join(root, 'release/docs/versions/current/ar/index.html')));
    config.content.media = { enabled: true, images: false, videos: true };
    config.reader.showByline = true; config.authors.writer.name = 'Fixture Writer';
    config.reader.editPlacement = 'footer'; config.reader.editStyle = 'subtle';
    config.localization.fallback = true; save();

    // A malformed source and broken links must stop the exact generated CLI.
    config.navigation[0].items[0].icon = 'assets/missing-icon.svg'; save();
    assert.throws(() => command(root, 'scripts/docsy.mjs', 'validate'), /navigation.0.items.0.icon: missing sidebar icon/);
    config.navigation[0].items[0].icon = 'lucide:rocket'; save();
    write(root, 'content/guide.md', '## Known\n\n[missing](../absent)\n');
    assert.throws(() => command(root, 'scripts/docsy.mjs', 'validate'), /broken link/);
    write(root, 'content/guide.md', '## Known\n\n[missing](#absent)\n');
    assert.throws(() => command(root, 'scripts/docsy.mjs', 'validate'), /broken anchor/);
    write(root, 'content/guide.md', '## Details\n\nThe elusive platypusword appears in the paragraph.\n');
    write(root, 'sources/api.yaml', 'not: an API');
    assert.throws(() => command(root, 'scripts/docsy.mjs', 'validate'), /Could not ingest/);
    write(root, 'sources/api.yaml', dump({ openapi: '3.1.0', info: { title: 'Widgets', version: '2' }, paths: { '/widgets': { get: { responses: { 200: { description: 'OK' } } } } } }));

    config.access.mode = 'locked'; config.agent.query = true; save();
    config.content.mdx = { allowJavaScript: true, components: { Status: 'content/Status.tsx' } };
    write(root, 'content/Status.tsx', 'export default function Status() { return <strong>Trusted component output</strong>; }');
    write(root, 'content/secret.ts', 'export const label = "classifiedsecretword";');
    write(root, 'content/private.mdx', 'import { label } from "./secret.ts"\n\n## Restricted\n\n<Status />\n\n<Warning>{label} must never leak to public retrieval.</Warning>\n\n```mermaid Private sequence\nsequenceDiagram\nReader->>Docsy: classifieddiagramneedle\n```\n\n<PlantUml src="protected" />\n');
    save();
    command(root, 'scripts/docsy.mjs', 'build');
    assert.ok(existsSync(join(root, 'dist/server/entry.mjs')));
    assert.ok(!existsSync(join(root, 'release/docs/agent/index.json')));
    let server = await serve(root);
    try {
      const auth = { 'x-docsy-tiers': 'pro' };
      assert.equal((await fetch(`${server.base}/guides/${nestedLeaf}`, { redirect: 'manual' })).status, 302);
      assert.equal((await fetch(`${server.base}/format-md/guides/${nestedLeaf}`)).status, 401);
      for (const key of [`guides/${nestedLeaf}.md`, `guides/${nestedLeaf}.md/`, `versions/v1/fr/guides/${nestedLeaf}.md`, `guides/${nestedLeaf.replace('nested', '%6eested')}%2emd`]) {
        assert.equal((await fetch(`${server.base}/format-md/${key}`)).status, 401, key);
      }
      assert.equal((await fetch(`${server.base}/agent/pages/guides/${nestedLeaf}.json`)).status, 404);
      const deep = await fetch(`${server.base}/guides/${nestedLeaf}`, { headers: auth });
      assert.equal(deep.status, 200); assert.match(await deep.text(), /nestedquokkaproof/);
      const allowedDeep = await (await fetch(`${server.base}/agent/pages/guides/${nestedLeaf}.json`, { headers: auth })).json();
      assert.match(allowedDeep.markdown, /nestedquokkaproof/);
      assert.ok(allowedDeep.markdownUrl.endsWith(`${nestedLeaf}.md`));
      assert.match(await (await fetch(allowedDeep.markdownUrl.replace('https://docs.example.test/docs', server.base), { headers: auth })).text(), /nestedquokkaproof/);
      assert.doesNotMatch(await (await fetch(`${server.base}/format-md/index`)).text(), new RegExp(nestedLeaf));
      assert.equal((await (await fetch(`${server.base}/agent/query.json?q=nestedquokkaproof`)).json()).count, 0);
      const mediaPage = await fetch(`${server.base}/guides/guide`);
      const mediaHtml = await mediaPage.text();
      assert.match(mediaHtml, /<dialog[^>]*data-images="false"[^>]*data-videos="true"/);
      assert.match(mediaHtml, /data-sidebar-icon="lucide:rocket"/); assert.match(mediaHtml, /data-sidebar-icon="tabler:api"/);
      for (const path of ['/search-index.json', '/agent/index.json', '/llms.txt', '/llms-full.txt']) {
        const response = await fetch(`${server.base}${path}`);
        assert.match(response.headers.get('cache-control') ?? '', /private.*no-store/);
        const body = await response.text();
        assert.ok(!body.includes('classifiedsecretword'), `Leak in ${path}`);
        assert.ok(!body.includes('classifieddiagramneedle'), `Diagram leak in ${path}`);
        assert.ok(!body.includes('Restricted guide'), `Private metadata leak in ${path}`);
        assert.ok(!body.includes('PrivateAuthorIdentity'), `Private authorship leak in ${path}`);
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
        response = await fetch(`${server.base}/${key}`, { headers: auth }); assert.equal(response.status, 200);
        const authorizedHtml = await response.text();
        assert.match(authorizedHtml, /Trusted component output/); assert.match(authorizedHtml, /data-docsy-mermaid/); assert.match(authorizedHtml, /download="private.puml"/);
      }
      response = await fetch(`${server.base}/guides/private`, { redirect: 'manual' }); assert.equal(response.status, 302);
      response = await fetch(`${server.base}/guides/private`, { headers: { accept: 'text/markdown' } }); assert.equal(response.status, 401);
      response = await fetch(`${server.base}/guides/guide`, { headers: { accept: 'text/markdown' } }); assert.match(response.headers.get('content-type')!, /text\/markdown/); assert.match(await response.text(), /platypusword/);
      response = await fetch(`${server.base}/agent/query.json?q=test&limit=999`); assert.equal(response.status, 400);
      response = await fetch(`${server.base}/old-guide/`, { redirect: 'manual' }); assert.equal(response.status, 301, `Redirect response: ${response.status} ${response.headers.get('location')}`); assert.equal(response.headers.get('location'), '/docs/guides/guide');
      response = await fetch(`${server.base}/old-private/`, { redirect: 'manual' }); assert.equal(response.status, 302); assert.match(response.headers.get('location')!, /\/docs\/locked/);
      response = await fetch(`${server.base}/old-private/`, { redirect: 'manual', headers: auth }); assert.equal(response.status, 301); assert.equal(response.headers.get('location'), '/docs/guides/private');
      response = await fetch(`${server.base}/agent/pages/not-a-document.json`); assert.equal(response.status, 404);
      assert.doesNotMatch(await response.text(), /not-found-title/);
      for (const path of ['/not-a-sdk', '/guides/not-a-document', '/api/not-a-section', '/nested/missing', '/versions/missing/en/guides/missing']) {
        const missing = await fetch(`${server.base}${path}`, { redirect: 'manual' });
        assert.equal(missing.status, 404, `${path} must not redirect or return 200`);
        assert.match(await missing.text(), /The fixture page is missing/);
      }
      const missingFrench = await fetch(`${server.base}/versions/current/fr/guides/missing`);
      assert.equal(missingFrench.status, 404); const missingFrenchHtml = await missingFrench.text();
      assert.match(missingFrenchHtml, /lang="fr"/); assert.match(missingFrenchHtml, /Page introuvable/);
      assert.match(missingFrenchHtml, /href="\/docs\/versions\/current\/fr"/);
      assert.doesNotMatch(missingFrenchHtml, /classifiedsecretword|classifieddiagramneedle|PrivateAuthorIdentity/);
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
