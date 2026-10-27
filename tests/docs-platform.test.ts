import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { dump } from 'js-yaml';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { readOpenApi } from '../src/lib/openapi';
import { filterEndpoints } from '../src/lib/swagger-loader';
import { loadSdk } from '../src/lib/sdk-loaders';
import { richPlugins, plainMarkdown } from '../src/lib/rich-markdown';
import { htmlSections, extractHtml } from '../src/lib/html-content';
import { searchRecords, type SearchRecord } from '../src/lib/search';

const repo = process.cwd();
const temporary: string[] = [];
const temp = () => { const dir = mkdtempSync(join(tmpdir(), 'docsy-platform-')); temporary.push(dir); return dir; };
afterEach(() => { for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const write = (root: string, file: string, value: string) => { const path = join(root, file); mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, value); return path; };
const spec = (): any => ({ openapi: '3.1.0', info: { title: 'Widgets', version: '1.0' }, paths: { '/widgets': { get: { responses: { 200: { description: 'OK' } } } } } });
const section = { section: 'widgets', title: 'Widgets', description: '', tags: [], paths: ['/widgets'] };
const fixture = (patch: any = {}) => {
  const root = temp();
  write(root, 'content/guide.md', '# Body\n\nA rare platypus lives inside the paragraph.\n\n## Details\n\nHandle retries carefully.\n');
  const config: any = { site: { name: 'Test', title: 'Docs', description: 'Test docs', origin: 'https://docs.example.test', basePath: '/docs', logo: 'assets/logo.svg' }, home: { title: 'Docs', description: 'Test docs', primaryAction: { label: 'Start', href: '/guides/guide' } }, content: { articles: [{ slug: 'guide', title: 'Guide', source: 'content/guide.md' }] }, navigation: [], ingestion: { openapi: { enabled: false, source: 'unused.yaml', apiBaseUrl: 'https://api.example.test' } }, ...patch };
  write(root, 'docsy.config.yaml', dump(config));
  return { root, config };
};
const run = (root: string, code: string) => execFileSync(process.execPath, ['--import', resolve(repo, 'node_modules/tsx/dist/loader.mjs'), '--input-type=module', '-e', code], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, DOCSY_CONFIG: 'docsy.config.yaml' } }).trim();
const moduleUrl = (path: string) => JSON.stringify(new URL(`../${path}`, import.meta.url).href);
const record = (overrides: Partial<SearchRecord> = {}): SearchRecord => ({ id: 'one', type: 'page', title: 'Guide', url: '/docs/guides/guide', group: 'Guides', body: 'A platypus lives here.', version: 'current', locale: 'en', markdownUrl: '/docs/format-md/guides/guide', jsonUrl: '/docs/agent/pages/guides/guide.json', ...overrides });

test('recursive YAML preserves 32 navigation levels, localized labels and icons within parser safety limits', () => {
  const { root, config } = fixture();
  let item: any = { title: 'Level 32', titles: { fr: 'Niveau 32' }, href: '/guides/guide', icon: 'lucide:book-open' };
  for (let i = 31; i > 0; i--) item = { title: `Level ${i}`, titles: { fr: `Niveau ${i}` }, href: '/guides/guide', items: [item] };
  config.navigation = [{ title: 'Deep docs', items: [item] }];
  write(root, 'docsy.config.yaml', dump(config));
  const nav = JSON.parse(run(root, `import {getDocsNav} from ${moduleUrl('src/data/docs-nav.ts')}; console.log(JSON.stringify(getDocsNav({version:'current',locale:'fr'})));`));
  let current = nav[0].items[0];
  for (let i = 1; i <= 32; i++) {
    assert.equal(current.title, `Niveau ${i}`);
    assert.equal(current.href, '/docs/versions/current/fr/guides/guide');
    if (i < 32) current = current.items[0];
  }
  assert.equal(current.icon.reference, 'lucide:book-open');
});

test('nested overview Markdown keeps readable descendants without leaking locked ancestor labels', () => {
  const { root, config } = fixture();
  config.content.articles.push({ slug: 'secret', title: 'Private root', source: 'content/guide.md' }, { slug: 'secret/deep', title: 'Private leaf', source: 'content/guide.md' });
  config.navigation = [{ title: 'Tree', items: [{ title: 'Private root', href: '/guides/secret', items: [{ title: 'Public descendant', href: '/guides/guide', items: [{ title: 'Private leaf', href: '/guides/secret/deep' }] }] }] }];
  config.access = { mode: 'locked', tiers: { pro: { label: 'Pro' } }, rules: [{ pattern: '/guides/secret', tiers: ['pro'] }, { pattern: '/guides/secret/deep', tiers: ['pro'] }] };
  write(root, 'docsy.config.yaml', dump(config));
  const read = (tiers: string[]) => JSON.parse(run(root, `import {generateMarkdown} from ${moduleUrl('src/lib/markdown-export.ts')}; console.log(JSON.stringify(await generateMarkdown('/docs','https://docs.example.test',${JSON.stringify(tiers)})));`));
  assert.match(read([]), /^- \[Public descendant\]/m);
  assert.doesNotMatch(read([]), /Private root|Private leaf|\/guides\/secret/);
  assert.match(read(['pro']), /^    - \[Private leaf\]\(\/docs\/guides\/secret\/deep\)$/m);
});

test('minimal YAML retains nested defaults after the Zod 4 migration', () => {
  const { root } = fixture();
  const config = JSON.parse(run(root, `import {docsyConfig} from ${moduleUrl('src/config.ts')}; console.log(JSON.stringify(docsyConfig));`));
  assert.deepEqual(config.sidebar, { iconSize: 16 });
  assert.equal(config.theme.mode, 'light');
  assert.equal(config.theme.colors.ink, '#111116');
  assert.equal(config.theme.darkColors.ink, '#f5f5f5');
  assert.equal(config.theme.code.darkTheme, 'github-dark-high-contrast');
  assert.ok(config.theme.fonts.body);
  assert.equal(config.content.media.enabled, true);
  assert.equal(config.content.mdx.allowJavaScript, false);
  assert.equal(config.content.mermaid.maxEdges, 500);
  assert.deepEqual(config.content.snippets, {});
  assert.deepEqual(config.content.diagrams, {});
  assert.deepEqual(config.versions, { default: 'current', items: [{ id: 'current', label: 'Current', status: 'current' }] });
  assert.equal(config.access.mode, 'open');
  assert.equal(config.access.gate.loginLabel, 'Sign in to continue');
  assert.equal(config.maintenance.enabled, false);
  assert.deepEqual(config.ingestion.openapi.examples.languages, ['curl', 'javascript', 'python']);
});

test('full-text search finds body-only terms, normalizes accents, and requires all query terms', () => {
  assert.equal(searchRecords([record()], 'platypus')[0].id, 'one');
  assert.equal(searchRecords([record({ body: 'Pravila za plaćanje' })], 'placanje').length, 1);
  assert.equal(searchRecords([record()], 'platypus zebra').length, 0);
  assert.equal(searchRecords([record()], '!!!').length, 0);
  assert.equal(searchRecords([record({ body: 'Content is nested.' })], 'ten nested').length, 0);
  assert.equal(searchRecords([record({ body: 'No more than ten nested includes.' })], 'ten nested').length, 1);
});
test('YAML heading copy controls default on and can be disabled', () => {
  const { root, config } = fixture();
  const read = `import {docsyConfig} from ${moduleUrl('src/config.ts')}; console.log(JSON.stringify(docsyConfig.reader.headingLinks));`;
  assert.equal(JSON.parse(run(root, read)), true);
  config.reader = { headingLinks: false }; write(root, 'docsy.config.yaml', dump(config));
  assert.equal(JSON.parse(run(root, read)), false);
});
test('YAML 404 defaults, layout, image and translated copy are configurable', () => {
  const { root, config } = fixture();
  const read = `import {docsyConfig} from ${moduleUrl('src/config.ts')}; console.log(JSON.stringify(docsyConfig.notFound));`;
  const defaults = JSON.parse(run(root, read));
  assert.equal(defaults.layout, 'centered'); assert.equal(defaults.showCode, true); assert.equal(defaults.showSearch, true);
  assert.deepEqual(defaults.primaryAction, { label: 'Back to docs', href: '/' }); assert.deepEqual(defaults.links, []);
  config.notFound = { layout: 'docs', title: 'Lost?', showCode: false, showSearch: false, image: { src: 'assets/error.svg', alt: 'Custom art' }, secondaryAction: { label: 'Support', href: 'https://example.test/support' }, translations: { fr: { title: 'Page introuvable', primaryActionLabel: 'Accueil' } } };
  write(root, 'docsy.config.yaml', dump(config)); const custom = JSON.parse(run(root, read));
  assert.equal(custom.layout, 'docs'); assert.equal(custom.showCode, false); assert.equal(custom.showSearch, false);
  assert.equal(custom.image.src, 'assets/error.svg'); assert.equal(custom.translations.fr.title, 'Page introuvable');
  config.notFound.layout = 'random'; write(root, 'docsy.config.yaml', dump(config));
  assert.throws(() => run(root, read), /notFound.layout/);
});
test('404 actions reject executable/protocol-relative URLs and bound the recovery list', () => {
  const { root, config } = fixture();
  const read = `import ${moduleUrl('src/config.ts')};`;
  for (const href of ['javascript:alert(1)', 'data:text/html,bad', '//evil.test', '/\\evil.test', '/bad\npath', '/%5c%5cevil.test', '/%2fexample.test', '/%2e%2e/outside']) {
    config.notFound = { primaryAction: { label: 'Unsafe', href } }; write(root, 'docsy.config.yaml', dump(config));
    assert.throws(() => run(root, read), /notFound.primaryAction.href/);
  }
  config.notFound = { image: { src: 'javascript:alert(1)' } }; write(root, 'docsy.config.yaml', dump(config));
  assert.throws(() => run(root, read), /notFound.image.src/);
  config.notFound = { links: Array.from({ length: 7 }, () => ({ label: 'Home', href: '/' })) }; write(root, 'docsy.config.yaml', dump(config));
  assert.throws(() => run(root, read), /notFound.links/);
  config.notFound = {}; config.redirects = { '/404': '/guides/guide' }; write(root, 'docsy.config.yaml', dump(config));
  assert.throws(() => run(root, read), /cannot shadow/);
});
test('404 recovery links retain available contexts and fall back for untranslated articles', () => {
  const { root } = fixture({ localization: { defaultLocale: 'en', fallback: false, locales: [{ code: 'en', label: 'English' }, { code: 'fr', label: 'Français' }] } });
  const code = `import {notFoundHref} from ${moduleUrl('src/lib/not-found.ts')}; const context={version:'current',locale:'fr'}; console.log(JSON.stringify([notFoundHref('/guides/guide#details',context),notFoundHref('/',context),notFoundHref('HTTPS://support.example.test',context)]));`;
  assert.deepEqual(JSON.parse(run(root, code)), ['/docs/guides/guide#details', '/docs/versions/current/fr', 'HTTPS://support.example.test']);
});
test('YAML media viewer defaults and individual switches are validated', () => {
  const { root, config } = fixture();
  const read = `import {docsyConfig} from ${moduleUrl('src/config.ts')}; console.log(JSON.stringify(docsyConfig.content.media));`;
  assert.deepEqual(JSON.parse(run(root, read)), { enabled: true, images: true, videos: true });
  config.content.media = { enabled: true, images: false, videos: true }; write(root, 'docsy.config.yaml', dump(config));
  assert.deepEqual(JSON.parse(run(root, read)), config.content.media);
  config.content.media = { enabled: false }; write(root, 'docsy.config.yaml', dump(config));
  assert.equal(JSON.parse(run(root, read)).enabled, false);
  config.content.media = { images: 'yes' }; write(root, 'docsy.config.yaml', dump(config));
  assert.throws(() => run(root, read), /boolean/);
});
test('search prioritizes exact titles, filters version/locale/type, and bounds output', () => {
  const records = [record(), record({ id: 'two', title: 'Platypus', type: 'api' }), record({ id: 'three', locale: 'fr' }), record({ id: 'four', version: 'v1' })];
  assert.equal(searchRecords(records, 'platypus')[0].id, 'two');
  assert.deepEqual(searchRecords(records, 'platypus', { locale: 'en', version: 'current', type: 'api' }).map((hit) => hit.id), ['two']);
  assert.equal(searchRecords(records, 'platypus', { limit: 1 }).length, 1);
});
test('HTML extraction searches code and component bodies, not executable script/style text', () => {
  const html = '<p>Intro</p><h2 id="retries">Retries</h2><aside><p>Retry carefully.</p></aside><pre><code>retry(3)</code></pre><script>secret()</script>';
  const sections = htmlSections(html);
  assert.equal(sections[1].id, 'retries'); assert.match(sections[1].text, /retry\(3\)/);
  assert.ok(!extractHtml(html).text.includes('secret'));
});
test('rich Markdown renders callouts, tabs, steps, accordions and code groups without dropping content', async () => {
  const markdown = ':::note[Important]\nKeep credentials safe.\n:::\n\n:::steps\n1. Install\n2. Build\n:::\n\n::::tabs{sync="runtime"}\n:::tab[Node]\nUse Node.\n:::\n:::tab[Python]\nUse Python.\n:::\n::::\n\n:::accordion[More]\nDetails.\n:::\n\n:::code-group\n```js\nhello()\n```\n```python\nhello()\n```\n:::';
  const processor = await createMarkdownProcessor({ syntaxHighlight: false, remarkPlugins: richPlugins as any });
  const rendered = await processor.render(markdown);
  for (const className of ['docsy-callout', 'docsy-tabs', 'docsy-steps', 'docsy-accordion']) assert.ok(rendered.code.includes(className));
  assert.match(rendered.code, /<summary[^>]*>More/); assert.ok(rendered.code.includes('data-sync="runtime"'));
  assert.match(rendered.code, /class="docsy-callout-icon" aria-hidden="true"/);
  assert.match(rendered.code, /<svg[^>]*viewBox="0 0 24 24"/);
  assert.match(rendered.code, /class="docsy-callout-content"/);
  const exported = plainMarkdown(markdown); assert.ok(!exported.includes(':::')); assert.match(exported, /Use Python/);
});
test('unknown components and orphan tabs fail validation instead of silently degrading', async () => {
  const log = test.mock.method(console, 'error', () => {});
  const processor = await createMarkdownProcessor({ syntaxHighlight: false, remarkPlugins: richPlugins as any });
  try {
    await assert.rejects(processor.render(':::unknown\nText\n:::'), /Unknown article component/);
    await assert.rejects(processor.render(':::tab[Orphan]\nText\n:::'), /nested inside tabs/);
    await assert.rejects(processor.render(':::steps\nNot a list\n:::'), /ordered list/);
  } finally { log.mock.restore(); }
});
test('registered snippets expand recursively, ignore fenced examples, and reject cycles', () => {
  const { root } = fixture({ content: { articles: [], snippets: { shared: 'content/shared.md', escaped: 'content/escaped.md' } } });
  write(root, 'content/shared.md', 'Shared instructions.');
  const code = `import {expandSnippets} from ${moduleUrl('src/lib/rich-markdown.ts')}; console.log(JSON.stringify([expandSnippets('::include{src="shared"}'),expandSnippets('\x60\x60\x60md\\n::include{src="shared"}\\n\x60\x60\x60')]));`;
  const output = JSON.parse(run(root, code)); assert.equal(output[0], 'Shared instructions.'); assert.ok(output[1].includes('::include'));
  write(root, 'content/shared.md', '::include{src="shared"}');
  assert.throws(() => run(root, `import {expandSnippets} from ${moduleUrl('src/lib/rich-markdown.ts')}; expandSnippets('::include{src="shared"}');`), /Circular\/deep snippet/);
  symlinkSync(write(temp(), 'outside.md', 'Outside project.'), join(root, 'content/escaped.md'));
  assert.throws(() => run(root, `import {expandSnippets} from ${moduleUrl('src/lib/rich-markdown.ts')}; expandSnippets('::include{src="escaped"}');`), /stay inside the project/);
});
test('OpenAPI loader validates structural errors, missing files and unresolved references', async () => {
  const root = temp(); const source = write(root, 'api.yaml', dump(spec()));
  assert.equal((await readOpenApi(source)).info.title, 'Widgets');
  await assert.rejects(readOpenApi(join(root, 'missing.yaml')), /Could not ingest/);
  write(root, 'invalid.yaml', 'hello: world'); await assert.rejects(readOpenApi(join(root, 'invalid.yaml')), /Could not ingest/);
  const broken = spec(); broken.paths['/widgets'].get.responses[200].content = { 'application/json': { schema: { $ref: '#/components/schemas/Missing' } } };
  write(root, 'broken.yaml', dump(broken)); await assert.rejects(readOpenApi(join(root, 'broken.yaml')), /no-unresolved-refs/);
});
test('OpenAPI validates examples against schemas and resolves external model/parameter references', async () => {
  const root = temp(); const api = spec();
  api.paths['/widgets'].parameters = [{ $ref: './parameters.yaml#/Tenant' }];
  api.paths['/widgets'].get.responses[200].content = { 'application/json': { schema: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } }, example: { id: 'wrong' } } };
  write(root, 'parameters.yaml', 'Tenant:\n  name: tenant\n  in: query\n  required: true\n  schema:\n    type: string\n');
  const path = write(root, 'api.yaml', dump(api)); await assert.rejects(readOpenApi(path), /no-invalid-media-type-examples/);
  api.paths['/widgets'].get.responses[200].content['application/json'].example.id = 1;
  write(root, 'api.yaml', dump(api));
  const loaded = await readOpenApi(path); assert.equal(loaded.paths['/widgets'].parameters[0].name, 'tenant');
});
test('API examples use API-key/Basic auth and inherited required query/header parameters', () => {
  const api = spec(); api.components = { securitySchemes: { key: { type: 'apiKey', in: 'header', name: 'X-API-Key' } } }; api.security = [{ key: [] }];
  api.paths['/widgets'].parameters = [{ name: 'tenant', in: 'query', required: true, schema: { type: 'string' } }, { name: 'X-Trace', in: 'header', required: true }];
  let endpoint = filterEndpoints(api, section)[0];
  assert.match(endpoint.curl, /X-API-Key: <api-key>/); assert.match(endpoint.curl, /tenant=<tenant>/); assert.match(endpoint.curl, /X-Trace: <X-Trace>/); assert.ok(!endpoint.curl.includes('Bearer'));
  api.components.securitySchemes.key = { type: 'http', scheme: 'basic' }; endpoint = filterEndpoints(api, section)[0]; assert.match(endpoint.curl, /--user/);
  api.security = [{ key: [] }, {}]; assert.equal(filterEndpoints(api, section)[0].needsAuth, false);
});
test('explicit JSON media examples and scalar/empty request bodies are preserved', () => {
  const api = spec();
  api.paths['/widgets'].post = { requestBody: { content: { 'application/json': { schema: { type: 'boolean' }, example: false } } }, responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object' }, example: { accepted: true } } } } } };
  const endpoint = filterEndpoints(api, section).find((entry) => entry.method === 'post')!;
  assert.match(endpoint.curl, /--data 'false'/); assert.match(endpoint.responseExample!, /"accepted": true/);
  api.paths['/widgets'].post.requestBody.content['application/json'].example = {};
  assert.match(filterEndpoints(api, section).find((entry) => entry.method === 'post')!.curl, /--data '\{\}'/);
});
test('curl parameter examples are inherited, encoded and preserve false and zero', () => {
  const api = spec();
  api.paths = { '/widgets/{id}': {
    parameters: [{ name: 'id', in: 'path', required: true, example: 'a/b c' }],
    get: {
      parameters: [
        { name: 'page', in: 'query', schema: { default: 0 } },
        { name: 'enabled', in: 'query', examples: { disabled: { value: false } } },
        { name: 'q', in: 'query', schema: { example: 'x&y=z' } },
        { name: 'omit', in: 'query' },
        { name: 'X-Example', in: 'header', example: "reader's value" },
      ],
      responses: { 200: { description: 'OK' } },
    },
  } };
  const endpoint = filterEndpoints(api, section)[0];
  assert.match(endpoint.curl, /\/widgets\/a%2Fb%20c\?page=0&enabled=false&q=x%26y%3Dz/);
  assert.ok(!endpoint.curl.includes('omit='));
  assert.ok(endpoint.curl.includes(`X-Example: reader'"'"'s value`));
  api.paths['/widgets/{id}'].get.parameters.push({ name: 'id', in: 'path', required: true, example: 2 });
  assert.match(filterEndpoints(api, section)[0].curl, /\/widgets\/2\?/);
});
test('SDK source errors and incorrect adapter shapes fail loudly', () => {
  const root = temp(); const source = write(root, 'sdk.json', '{}');
  const config: any = { source, adapter: 'typedoc-lite', id: 'test', slug: 'sdk', name: 'SDK', language: 'typescript', install: '', overview: '', versions: {} };
  assert.throws(() => loadSdk(config), /does not match/);
  config.source = join(root, 'missing.json'); assert.throws(() => loadSdk(config), /Could not ingest SDK/);
});
test('version/locale selection preserves shared pages, overrides and fallback rules', () => {
  const content = { articles: [{ slug: 'guide', source: 'content/guide.md', title: 'Shared' }, { slug: 'guide', version: 'v1', source: 'content/guide.md', title: 'Old version' }, { slug: 'guide', locale: 'fr', source: 'content/guide.md', title: 'Français' }] };
  const { root } = fixture({ content, versions: { default: 'current', items: [{ id: 'current', label: 'Current' }, { id: 'v1', label: 'V1' }] }, localization: { defaultLocale: 'en', locales: [{ code: 'en', label: 'English' }, { code: 'fr', label: 'Français' }] } });
  const code = `import {getArticleSources} from ${moduleUrl('src/lib/article-loader.ts')}; import {docsPath,parseDocsPath} from ${moduleUrl('src/config.ts')}; console.log(JSON.stringify([getArticleSources({version:'v1',locale:'en'})[0].title,getArticleSources({version:'current',locale:'fr'})[0].title,docsPath('/guides/guide',{version:'v1',locale:'fr'}),parseDocsPath('/docs/versions/v1/fr/guides/guide')]));`;
  const result = JSON.parse(run(root, code)); assert.equal(result[0], 'Old version'); assert.equal(result[1], 'Français'); assert.equal(result[2], '/docs/versions/v1/fr/guides/guide'); assert.equal(result[3].context.locale, 'fr');
});
test('disabled locale fallback omits missing pages and duplicate variants are rejected', () => {
  const { root, config } = fixture({ localization: { defaultLocale: 'en', fallback: false, locales: [{ code: 'en', label: 'English' }, { code: 'fr', label: 'Français' }] } });
  assert.equal(run(root, `import {getArticleSources} from ${moduleUrl('src/lib/article-loader.ts')}; console.log(getArticleSources({version:'current',locale:'fr'}).length);`), '0');
  config.content.articles.push(config.content.articles[0]); write(root, 'docsy.config.yaml', dump(config));
  assert.throws(() => run(root, `await import(${moduleUrl('src/config.ts')});`), /Duplicate article/);
});
test('redirect cycles, duplicate aliases, reserved routes and unsafe reader URLs are rejected', () => {
  const invalid = [
    { redirects: { '/old': '/other/', '/other': '/old' } },
    { redirects: { '/old': '/guides/guide', '/old/': '/guides/guide' } },
    { redirects: { '/agent/index.json': '/guides/guide' } },
    { reader: { editUrl: 'javascript:alert(1)' } },
    { reader: { reportUrl: 'data:text/html,unsafe' } },
  ];
  for (const patch of invalid) {
    const { root } = fixture(patch);
    assert.throws(() => run(root, `await import(${moduleUrl('src/config.ts')});`), /Invalid Docsy configuration/);
  }
});
test('JSON query and corpus are permission-filtered, bounded and version aware', () => {
  const { root } = fixture({ agent: { query: true }, access: { mode: 'locked', tiers: { pro: { label: 'Pro' } }, rules: [{ pattern: '/guides/guide', tiers: ['pro'] }] } });
  const code = `import {GET} from ${moduleUrl('src/pages/agent/query.json.ts')}; const call=async(q,tiers=[])=>{const r=await GET({url:new URL('http://localhost/docs/agent/query.json?'+q),locals:{docsyAccess:{authenticated:!!tiers.length,tiers}},clientAddress:'127.0.0.1'});return {status:r.status,body:await r.json()}}; console.log(JSON.stringify([await call('q=platypus'),await call('q=platypus',['pro']),await call('q=platypus&limit=500'),await call('q=platypus&locale=zz')]));`;
  const result = JSON.parse(run(root, code)); assert.equal(result[0].body.count, 0); assert.equal(result[1].body.count, 1); assert.ok(result[1].body.results[0].jsonUrl.endsWith('.json')); assert.ok(!('body' in result[1].body.results[0])); assert.equal(result[2].status, 400); assert.equal(result[3].status, 400);
});
test('static agent manifest explicitly reports unavailable runtime queries', () => {
  const { root } = fixture();
  const result = JSON.parse(run(root, `import {GET} from ${moduleUrl('src/pages/agent/query.json.ts')}; console.log(JSON.stringify(await (await GET({})).json()));`));
  assert.equal(result.mode, 'static'); assert.equal(result.queryAvailable, false); assert.equal(result.indexUrl, '/docs/agent/index.json');
});
