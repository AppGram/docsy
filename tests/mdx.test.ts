import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { dump as yamlDump } from 'js-yaml';
import { renderMdx } from '../src/lib/mdx-renderer';
import { validateMdx } from '../scripts/lib/mdx-policy.mjs';
import { extractHtml } from '../src/lib/html-content';

const temporary: string[] = [];
const dump = (config: any) => yamlDump({ navigation: [], ...config });
const repo = resolve(import.meta.dirname, '..');
const write = (root: string, name: string, value: string) => { mkdirSync(dirname(resolve(root, name)), { recursive: true }); writeFileSync(resolve(root, name), value); };
afterEach(() => { for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true }); });
const fixture = (mdx: any = {}) => {
  const root = mkdtempSync(resolve(tmpdir(), 'docsy-mdx-')); temporary.push(root);
  symlinkSync(resolve(repo, 'node_modules'), resolve(root, 'node_modules'));
  write(root, 'content/article.mdx', '## Unique heading\n\n<Note>\nThe quokka uses native MDX.\n</Note>\n');
  write(root, 'docsy.config.yaml', dump({ site: { name: 'MDX test', title: 'Docs', description: 'Docs', origin: 'https://docs.example.test', basePath: '/docs', logo: 'assets/logo.svg' }, home: { title: 'Docs', description: 'Docs', primaryAction: { label: 'Read', href: '/guides/mdx' } }, ingestion: { openapi: { enabled: false, source: 'unused.yaml', apiBaseUrl: 'https://api.example.test' } }, content: { mdx, articles: [{ slug: 'mdx', source: 'content/article.mdx', title: 'MDX guide' }] }, versions: { items: [{ id: 'current', label: 'Current' }, { id: 'v1', label: 'V1' }] }, localization: { defaultLocale: 'en', locales: [{ code: 'en', label: 'English' }, { code: 'es', label: 'Español' }] }, access: { mode: 'locked', tiers: { pro: { label: 'Pro' } }, rules: [{ pattern: '/guides/mdx', tiers: ['pro'] }] } }));
  return root;
};
const moduleUrl = (path: string) => JSON.stringify(new URL(`../${path}`, import.meta.url).href);
const run = (root: string, code: string, runtime = process.execPath) => execFileSync(runtime, [...(runtime.endsWith('bun') ? [] : ['--import', resolve(repo, 'node_modules/tsx/dist/loader.mjs')]), '--input-type=module', '-e', code], { cwd: root, encoding: 'utf8', env: { ...process.env, DOCSY_CONFIG: 'docsy.config.yaml' }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

test('native MDX renders nested Mintlify components with Docsy styles, highlighting and exports', async () => {
  const source = '---\ntitle: Optional metadata\n---\n\n## Runtime\n\n<CardGroup cols={2}>\n<Card title="Start" href="/guides/getting-started">\nNested **content**.\n</Card>\n<Card title="Configure" href="/guides/tutorials/yaml-configuration">YAML.</Card>\n</CardGroup>\n\n<Tabs group="runtime">\n<Tab title="Node">\n<Note title="Secret">\nKeep tokens private.\n<Tip>Nested content survives.</Tip>\n</Note>\n</Tab>\n<Tab title="Bun">\n```ts request.ts\nconst token: string = "test";\n```\n</Tab>\n</Tabs>\n\n<Steps>\n<Step title="Install">Install it.</Step>\n<Step title="Build">Build it.</Step>\n</Steps>\n\n<Accordion title="Details" defaultOpen>\nMore information.\n</Accordion>\n\n| Key | Value |\n| --- | --- |\n| engine | MDX |\n';
  const doc = await renderMdx(source, '/tmp/components.mdx');
  for (const className of ['docsy-card-group', 'docsy-mdx-card', 'docsy-callout', 'docsy-tabs', 'docsy-tab', 'docsy-steps', 'docsy-accordion', 'cb-token']) assert.ok(doc.html.includes(className), className);
  assert.match(doc.html, /data-cols="2"/); assert.match(doc.html, /data-sync="runtime"/);
  assert.match(doc.html, /href="\/docsy\/guides\/getting-started"/);
  assert.match(doc.html, /request.ts/); assert.match(doc.html, /<table>/);
  assert.deepEqual(doc.headings, [{ depth: 2, slug: 'runtime', text: 'Runtime' }]);
  for (const text of ['Nested content survives.', 'Keep tokens private.', 'const token: string = "test";', 'More information.']) { assert.ok(doc.markdown.includes(text), text); assert.ok(extractHtml(doc.html).text.includes(text), text); }
  assert.ok(!doc.markdown.includes('<Tab')); assert.ok(!doc.markdown.includes('Copy code'));
});
test('code groups preserve code titles, duplicate headings get unique anchors, literal props and comments work', async () => {
  const doc = await renderMdx('## Same\n\n## Same\n\n{/* author comment */}\n\n<CodeGroup>\n```sh Node\nnpm run build\n```\n```sh Bun\nbun run build\n```\n</CodeGroup>', '/tmp/code.mdx');
  assert.deepEqual(doc.headings.map((heading) => heading.slug), ['same', 'same-1']);
  assert.match(doc.html, /data-label="Node"/); assert.match(doc.html, /data-label="Bun"/);
  assert.ok(!doc.html.includes('author comment')); assert.match(doc.markdown, /bun run build/);
});
test('declarative MDX rejects executable expressions, imports, spreads and unsafe markup without running them', () => {
  for (const source of [
    'export const x = globalThis.__docsyPwned = true',
    'import X from "./x.js"\n\n<X />',
    '{globalThis.__docsyPwned = true}',
    '{/* comment */ globalThis.__docsyPwned = true /* comment */}',
    '<Note {...props}>No</Note>', '<Note title={process.env.SECRET}>No</Note>',
    '<script>bad()</script>', '<iframe src="https://example.com" />',
    '<div onClick="bad()">No</div>', '<div dangerouslySetInnerHTML={{__html: "bad"}} />',
    '<a href="javascript:alert(1)">No</a>', '[No](javascript:alert%281%29)',
    '<Card href={"/docs"} title="No" />', '<Unknown />', '<Tab title="Orphan">No</Tab>',
    '<Tabs>Do not silently drop this paragraph.</Tabs>', '<CodeGroup>Not code.</CodeGroup>', '<Steps>Not steps.</Steps>',
  ]) assert.throws(() => validateMdx(source), (error: unknown) => error instanceof Error, source);
  assert.equal((globalThis as any).__docsyPwned, undefined);
  assert.doesNotThrow(() => validateMdx('<CardGroup cols={2}>\n<Card title="Safe" href="/docs">Text.</Card>\n</CardGroup>'));
  assert.throws(() => validateMdx('<Note>Disabled</Note>', { components: [] }), /disabled/);
});
test('YAML-registered MDX participates in permission-filtered search, JSON/Markdown, versions and locales', () => {
  const root = fixture();
  const output = JSON.parse(run(root, `import {loadArticle,getArticleSources,articleMarkdownExport} from ${moduleUrl('src/lib/article-loader.ts')}; import {buildCorpus} from ${moduleUrl('src/lib/corpus.ts')}; const a=getArticleSources({version:'v1',locale:'es'})[0]; const doc=await loadArticle(a); console.log(JSON.stringify({html:doc.html,md:await articleMarkdownExport(a),corpus:await buildCorpus()}));`));
  assert.match(output.html, /quokka/); assert.match(output.md, /# MDX guide/); assert.match(output.md, /quokka/);
  assert.ok(output.corpus.some((item: any) => item.version === 'v1' && item.locale === 'es' && item.body.includes('quokka')));
  const result = JSON.parse(run(root, `import {GET} from ${moduleUrl('src/pages/agent/pages/[...path].json.ts')}; const call=async(tiers=[])=>{const r=await GET({params:{path:'guides/mdx'},url:new URL('http://localhost/docs/agent/pages/guides/mdx.json'),locals:{docsyAccess:{authenticated:!!tiers.length,tiers}}});return {status:r.status,body:await r.text()}}; console.log(JSON.stringify([await call(),await call(['pro'])]));`));
  assert.equal(result[0].status, 404); assert.ok(!result[0].body.includes('quokka'));
  assert.equal(result[1].status, 200); assert.match(result[1].body, /quokka/);
});
for (const runtime of ['node', 'bun']) test(`trusted MDX supports imports, TSX and dependency-aware invalidation on ${runtime}`, { skip: runtime === 'bun' && spawnSync('bun', ['--version']).status !== 0 }, () => {
  const root = fixture({ allowJavaScript: true, components: { Badge: 'content/Badge.tsx' } });
  write(root, 'content/Badge.tsx', 'export default function Badge({children}) { return <strong data-badge="yes">{children}</strong> }');
  write(root, 'content/values.ts', 'export const answer = 42;');
  write(root, 'content/Shared.mdx', '<Tip>Imported MDX keeps its themed components.</Tip>');
  write(root, 'content/article.mdx', 'import { answer } from "./values.ts"\nimport Shared from "./Shared.mdx"\n\n## Trusted\n\n<Badge>Answer: {answer}</Badge>\n\n<Shared />');
  const code = `import {loadArticle,getArticleSources} from ${moduleUrl('src/lib/article-loader.ts')}; import {writeFileSync} from 'node:fs'; const a=getArticleSources()[0]; const first=await loadArticle(a); writeFileSync('content/values.ts','export const answer = 43;'); const second=await loadArticle(a); console.log(JSON.stringify([first,second]));`;
  const result = JSON.parse(run(root, code, runtime === 'bun' ? 'bun' : process.execPath));
  assert.match(result[0].html, /Answer: 42/); assert.match(result[1].html, /Answer: 43/); assert.match(result[1].markdown, /Answer: 43/);
  assert.match(result[0].html, /data-kind="tip"/); assert.match(result[0].markdown, /Imported MDX keeps its themed components/);
  assert.match(result[1].html, /data-badge="yes"/);
});
test('MDX can be disabled, custom code requires explicit trust, and malformed MDX fails loudly', async () => {
  const root = fixture({ enabled: false });
  assert.throws(() => run(root, `import {loadArticle,getArticleSources} from ${moduleUrl('src/lib/article-loader.ts')}; await loadArticle(getArticleSources()[0]);`), /MDX articles are disabled/);
  const untrusted = fixture({ components: { Badge: 'content/Badge.tsx' } });
  assert.throws(() => run(untrusted, `await import(${moduleUrl('src/config.ts')});`), /explicitly enable/);
  await assert.rejects(renderMdx('<Note>Unclosed', '/tmp/broken.mdx'), /Expected/);
});
