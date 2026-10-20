import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { dump, load } from 'js-yaml';

const repo = process.cwd(), temporary: string[] = [];
test('portal articles credit nedimf and AppGram across all registered versions and locales', () => {
  const config: any = load(readFileSync(resolve(repo, 'docsy.config.yaml'), 'utf8'));
  assert.equal(config.authors.nedimf.name, 'nedimf');
  assert.equal(config.authors.nedimf.github, 'nedimf');
  assert.equal(config.authors.appgram.kind, 'organization');
  assert.equal(config.authors.appgram.name, 'AppGram');
  assert.equal(config.authors.appgram.url, 'https://appgram.dev');
  assert.equal(config.authors.appgram.avatar, 'assets/ag-logo.svg');
  assert.match(readFileSync(resolve(repo, 'public', config.authors.appgram.avatar), 'utf8'), /viewBox="0 0 490 552"/);
  for (const article of config.content.articles) assert.deepEqual(article.authors, ['nedimf', 'appgram'], article.source);
  const guide = config.content.articles.find((article: any) => article.slug === 'tutorials/authors-and-edit-links');
  assert.deepEqual(guide.contributors, ['docsy-agent']);
  assert.equal(guide.provenance.agent, 'docsy-agent');
});
afterEach(() => { for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true }); });
const moduleUrl = (path: string) => JSON.stringify(new URL(`../${path}`, import.meta.url).href);
const run = (root: string, code: string) => execFileSync(process.execPath, ['--import', resolve(repo, 'node_modules/tsx/dist/loader.mjs'), '--input-type=module', '-e', code], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, DOCSY_CONFIG: 'docsy.config.yaml' } }).trim();
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'docsy-authors-')); temporary.push(root);
  mkdirSync(join(root, 'content')); writeFileSync(join(root, 'content/guide.md'), '## Setup\n\nReal instructions.\n'); writeFileSync(join(root, 'content/private.md'), '## Restricted\n\nPrivate instructions.\n');
  const config: any = {
    site: { name: 'Docs', title: 'Docs', description: 'Docs', origin: 'https://docs.example.test', basePath: '/docs', logo: 'assets/logo.svg' },
    home: { title: 'Docs', description: 'Docs', primaryAction: { label: 'Read', href: '/guides/guide' } }, navigation: [],
    authors: { alex: { name: 'Alex Writer', github: 'alex-writer', avatar: 'assets/alex.png' }, team: { name: 'Docs Team', kind: 'organization', url: 'https://example.test/team' }, agent: { name: 'Example Coding Agent', kind: 'agent', provider: 'Example provider' }, secret: { name: 'PrivateOnlyReviewer', kind: 'human' }, unused: { name: 'UnreferencedRegistryIdentity' } },
    reader: { editUrl: 'https://github.com/example/docs/edit/main/{source}', reportUrl: 'https://github.com/example/docs/issues/new' },
    content: { articles: [
      { slug: 'guide', title: 'Guide', source: 'content/guide.md', authors: ['alex', 'team'], contributors: ['agent'], reviewedBy: ['alex'], publishedAt: '2026-10-01', updatedAt: '2026-10-19', reviewedAt: '2026-10-19', provenance: { agent: 'agent', model: 'actual-model-id', referenceUrl: 'https://github.com/example/docs/pull/123' } },
      { slug: 'private', title: 'Private guide', source: 'content/private.md', authors: ['secret'] },
    ] },
    ingestion: { openapi: { enabled: false, source: 'unused.yaml', apiBaseUrl: 'https://api.example.test' } },
    versions: { items: [{ id: 'current', label: 'Current' }, { id: 'v1', label: 'V1' }] },
    localization: { defaultLocale: 'en', locales: [{ code: 'en', label: 'English' }, { code: 'es', label: 'Español' }] },
    access: { mode: 'locked', tiers: { pro: { label: 'Pro' } }, rules: [{ pattern: '/guides/private', tiers: ['pro'] }] },
  };
  const save = () => writeFileSync(join(root, 'docsy.config.yaml'), dump(config)); save();
  return { root, config, save };
};
const getCredits = `import {getArticleSources} from ${moduleUrl('src/lib/article-loader.ts')}; import {articleAuthorship} from ${moduleUrl('src/lib/authorship.ts')}; console.log(JSON.stringify(articleAuthorship(getArticleSources()[0])));`;

test('profiles resolve human/organization/agent credit with local avatars and no automatic GitHub avatar requests', () => {
  const { root } = fixture(); const credits = JSON.parse(run(root, getCredits));
  assert.equal(credits.authors[0].url, 'https://github.com/alex-writer'); assert.equal(credits.authors[0].avatar, '/docs/assets/alex.png');
  assert.equal(credits.authors[1].kind, 'organization'); assert.equal(credits.authors[1].url, 'https://example.test/team');
  assert.equal(credits.contributors[0].kind, 'agent'); assert.equal(credits.contributors[0].avatar, undefined);
  assert.equal(credits.provenance.agent.provider, 'Example provider'); assert.equal(credits.provenance.model, 'actual-model-id');
  assert.equal(credits.provenance.referenceUrl, 'https://github.com/example/docs/pull/123'); assert.equal(credits.score, undefined);
});
test('optional metadata is absent rather than inferred for existing articles', () => {
  const { root, config, save } = fixture(); config.content.articles[0] = { slug: 'guide', title: 'Guide', source: 'content/guide.md' }; save();
  assert.deepEqual(JSON.parse(run(root, getCredits)), { authors: [], contributors: [], reviewedBy: [] });
  const markdown = run(root, `import {getArticleSources,articleMarkdownExport} from ${moduleUrl('src/lib/article-loader.ts')}; console.log(await articleMarkdownExport(getArticleSources()[0]));`);
  assert.doesNotMatch(markdown, /Written by:|Updated:|Agent provenance:/);
});
test('individual pictures override the shared fallback and avatar URLs respect the base path', () => {
  const { root, config, save } = fixture(); config.reader.defaultAuthorAvatar = 'assets/authors/default.svg'; config.reader.unknownAuthorAvatar = 'assets/authors/unknown.svg'; save();
  let credits = JSON.parse(run(root, getCredits));
  assert.equal(credits.authors[0].avatar, '/docs/assets/alex.png');
  assert.equal(credits.authors[1].avatar, '/docs/assets/authors/default.svg');
  assert.equal(credits.contributors[0].avatar, '/docs/assets/authors/default.svg');
  config.authors.alex.avatar = 'https://images.example.test/alex.png'; config.reader.defaultAuthorAvatar = 'HTTPS://images.example.test/default.png'; save();
  credits = JSON.parse(run(root, getCredits));
  assert.equal(credits.authors[0].avatar, 'https://images.example.test/alex.png');
  assert.equal(credits.authors[1].avatar, 'HTTPS://images.example.test/default.png');
});
test('the unknown-author picture does not manufacture identity metadata or mask invalid references', () => {
  const { root, config, save } = fixture(); config.reader.unknownAuthorAvatar = 'assets/authors/unknown.svg';
  config.content.articles[0] = { slug: 'guide', title: 'Guide', source: 'content/guide.md' }; save();
  assert.deepEqual(JSON.parse(run(root, getCredits)), { authors: [], contributors: [], reviewedBy: [] });
  const metadata = run(root, `import {getArticleSources,articleMarkdownExport} from ${moduleUrl('src/lib/article-loader.ts')}; import {articleStructuredData} from ${moduleUrl('src/lib/authorship.ts')}; console.log(JSON.stringify({markdown: await articleMarkdownExport(getArticleSources()[0]), structured: articleStructuredData(getArticleSources()[0])}));`);
  assert.doesNotMatch(metadata, /Unknown author|unknown\.svg|Written by/);
  config.content.articles[0].authors = ['missing']; save();
  assert.throws(() => run(root, getCredits), /Invalid Docsy configuration/);
});
test('article metadata and source links follow the selected version/locale, including language fallback', () => {
  const { root, config, save } = fixture();
  config.content.articles.push({ slug: 'guide', title: 'Old guide', source: 'content/guide.md', version: 'v1', authors: ['team'], editUrl: false }); save();
  const output = JSON.parse(run(root, `import {getArticleSources} from ${moduleUrl('src/lib/article-loader.ts')}; import {articleAuthorship} from ${moduleUrl('src/lib/authorship.ts')}; import {readerLinks} from ${moduleUrl('src/lib/reader-links.ts')}; const context={version:'v1',locale:'es'}; const article=getArticleSources(context)[0]; console.log(JSON.stringify({credits:articleAuthorship(article),links:readerLinks({config:article},context)}));`));
  assert.deepEqual(output.credits.authors.map((author: any) => author.id), ['team']); assert.equal(output.links.edit, undefined);
  assert.match(new URL(output.links.report).searchParams.get('body')!, /Version: v1\nLanguage: es/);
});
test('global edit opt-out wins, page-specific URLs override, and profiles do not infer an edit repository', () => {
  const { root, config, save } = fixture();
  const links = `import {getArticleSources} from ${moduleUrl('src/lib/article-loader.ts')}; import {readerLinks} from ${moduleUrl('src/lib/reader-links.ts')}; console.log(JSON.stringify(readerLinks({config:getArticleSources()[0]},{version:'v1',locale:'es'})));`;
  config.content.articles[0].editUrl = 'https://github.com/other/repo/edit/docs/{locale}/{source}'; save();
  assert.equal(JSON.parse(run(root, links)).edit, 'https://github.com/other/repo/edit/docs/es/content/guide.md');
  config.reader.editEnabled = false; save(); assert.equal(JSON.parse(run(root, links)).edit, undefined);
  delete config.content.articles[0].editUrl; delete config.reader.editUrl; config.reader.editEnabled = true; save();
  assert.equal(JSON.parse(run(root, links)).edit, undefined);
});
test('edit link placement and prominence are independently configurable, with quiet footer defaults', () => {
  const { root, config, save } = fixture();
  const reader = `import {docsyConfig} from ${moduleUrl('src/config.ts')}; console.log(JSON.stringify(docsyConfig.reader));`;
  let settings = JSON.parse(run(root, reader));
  assert.equal(settings.editPlacement, 'footer'); assert.equal(settings.editStyle, 'subtle');
  for (const placement of ['header', 'footer']) for (const style of ['subtle', 'button']) {
    config.reader.editPlacement = placement; config.reader.editStyle = style; save();
    settings = JSON.parse(run(root, reader));
    assert.equal(settings.editPlacement, placement); assert.equal(settings.editStyle, style);
  }
  config.reader.editPlacement = 'floating'; save(); assert.throws(() => run(root, reader), /Invalid Docsy configuration/);
  config.reader.editPlacement = 'footer'; config.reader.editStyle = 'invisible'; save(); assert.throws(() => run(root, reader), /Invalid Docsy configuration/);
});
test('unknown/duplicate author references, unsafe URLs, invalid dates and fake agent references fail validation', () => {
  const { root, config, save } = fixture(); const baseline = structuredClone(config);
  const cases: ((value: any) => void)[] = [
    (v) => v.content.articles[0].authors = ['missing'], (v) => v.content.articles[0].contributors = ['agent', 'agent'],
    (v) => v.authors.alex.url = 'javascript:alert(1)', (v) => v.authors.alex.avatar = 'data:image/svg+xml,bad',
    (v) => v.reader.defaultAuthorAvatar = 'javascript:alert(1)', (v) => v.reader.unknownAuthorAvatar = '//tracking.example.test/avatar.png',
    (v) => v.reader.unknownAuthorAvatar = 'file:///etc/passwd', (v) => v.authors.alex.avatar = 'https://example.test/\navatar.png',
    (v) => v.reader.defaultAuthorAvatar = 'assets/\\evil.png',
    (v) => v.content.articles[0].editUrl = 'file:///tmp/private', (v) => v.content.articles[0].provenance.referenceUrl = 'javascript:bad()',
    (v) => v.content.articles[0].provenance.agent = 'alex', (v) => v.content.articles[0].provenance.agent = 'missing',
    (v) => v.content.articles[0].updatedAt = '2026-02-30', (v) => v.content.articles[0].updatedAt = '2025-12-31',
    (v) => v.content.articles[0].reviewedBy = [],
  ];
  for (const patch of cases) { Object.keys(config).forEach((key) => delete config[key]); Object.assign(config, structuredClone(baseline)); patch(config); save(); assert.throws(() => run(root, getCredits), /Invalid Docsy configuration/); }
});
test('attribution survives Markdown/JSON and search, without leaking private or unreferenced registry identities', () => {
  const { root } = fixture();
  const result = JSON.parse(run(root, `import {GET as page} from ${moduleUrl('src/pages/agent/pages/[...path].json.ts')}; import {GET as index} from ${moduleUrl('src/pages/agent/index.json.ts')}; const call=async(key,tiers=[])=>{const r=await page({params:{path:key},locals:{docsyAccess:{tiers}}});return{status:r.status,body:await r.text()}}; const listing=await index({locals:{docsyAccess:{tiers:[]}}});console.log(JSON.stringify({public:await call('guides/guide'),denied:await call('guides/private'),allowed:await call('guides/private',['pro']),index:await listing.text()}));`));
  assert.equal(result.public.status, 200); const article = JSON.parse(result.public.body);
  assert.equal(article.authorship.authors[0].name, 'Alex Writer'); assert.equal(article.authorship.provenance.model, 'actual-model-id');
  assert.match(article.markdown, /Written by:.*Alex Writer/); assert.match(article.markdown, /Reviewed by:/); assert.match(article.markdown, /Updated: 2026-10-19/); assert.match(article.markdown, /Agent provenance:/);
  assert.match(article.editUrl, /github.com\/example\/docs\/edit\/main\/content\/guide.md/);
  assert.equal(result.denied.status, 404); assert.doesNotMatch(result.denied.body, /PrivateOnlyReviewer/);
  assert.equal(result.allowed.status, 200); assert.match(result.allowed.body, /PrivateOnlyReviewer/);
  assert.doesNotMatch(result.index, /PrivateOnlyReviewer|UnreferencedRegistryIdentity/); assert.match(result.index, /Alex Writer/);
});
test('hiding the byline is a visual choice, not an export privacy control', () => {
  const { root, config, save } = fixture(); config.reader.showByline = false; save();
  const credits = JSON.parse(run(root, getCredits)); assert.equal(credits.authors[0].name, 'Alex Writer');
});
test('agent-only authors are never mislabeled as people in article structured data', () => {
  const { root, config, save } = fixture(); config.content.articles[0].authors = ['agent']; save();
  const output = JSON.parse(run(root, `import {getArticleSources} from ${moduleUrl('src/lib/article-loader.ts')}; import {articleStructuredData} from ${moduleUrl('src/lib/authorship.ts')}; console.log(JSON.stringify(articleStructuredData(getArticleSources()[0],{version:'v1',locale:'es'})));`));
  assert.equal(output.author, undefined); assert.equal(output.dateModified, '2026-10-19'); assert.equal(output.inLanguage, 'en'); assert.match(output.url, /\/versions\/v1\/es\/guides\/guide$/);
});
