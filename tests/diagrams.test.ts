import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { dump } from 'js-yaml';
import { validateMermaidSource } from '../src/lib/mermaid-policy';
import { inspectDiagramSvg } from '../src/lib/drawio';
import { mermaidPanelColor } from '../src/lib/mermaid-client';

const repo = process.cwd();
const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
const moduleUrl = (path: string) => JSON.stringify(new URL(`../${path}`, import.meta.url).href);
const write = (root: string, path: string, value: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), value); };
const run = (root: string, code: string) => execFileSync(process.execPath, ['--import', resolve(repo, 'node_modules/tsx/dist/loader.mjs'), '--input-type=module', '-e', code], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, DOCSY_CONFIG: 'docsy.config.yaml' } }).trim();
const notation = 'sequenceDiagram\n  Reader->>Docsy: Read otter architecture\n  Docsy-->>Reader: Authorized article';
const plantuml = '@startuml\nReader -> Docsy: Read otter architecture\n@enduml\n';
const fixture = (mdx = false) => {
  const root = mkdtempSync(join(tmpdir(), 'docsy-diagrams-')); directories.push(root);
  write(root, 'content/uml.svg', readFileSync('content/diagrams/article-review.svg', 'utf8'));
  write(root, 'content/uml.puml', plantuml);
  write(root, `content/article.${mdx ? 'mdx' : 'md'}`, `## Architecture\n\n\`\`\`mermaid Otter sequence\n${notation}\n\`\`\`\n\n${mdx ? '<PlantUml src="review" />' : '::plantuml{src="review"}'}\n`);
  const config: any = {
    site: { name: 'Test', title: 'Docs', description: 'Test docs', origin: 'https://docs.example.test', basePath: '/docs', logo: 'assets/logo.svg' },
    home: { title: 'Docs', description: 'Test docs', primaryAction: { label: 'Read', href: '/guides/architecture' } },
    content: { diagrams: { review: { format: 'plantuml', image: 'content/uml.svg', source: 'content/uml.puml', alt: 'Otter documentation review', caption: 'Review a documentation change.' } }, articles: [{ slug: 'architecture', title: 'Architecture', source: `content/article.${mdx ? 'mdx' : 'md'}` }] },
    navigation: [], ingestion: { openapi: { enabled: false, source: 'unused.yaml', apiBaseUrl: 'https://api.example.test' } },
    versions: { default: 'current', items: [{ id: 'current', label: 'Current' }, { id: 'v1', label: 'v1' }] },
    localization: { defaultLocale: 'en', locales: [{ code: 'en', label: 'English' }, { code: 'es', label: 'Español' }] },
    access: { mode: 'locked', tiers: { pro: { label: 'Pro' } }, rules: [{ pattern: '/guides/architecture', tiers: ['pro'] }] },
  };
  write(root, 'docsy.config.yaml', dump(config)); return { root, config };
};

test('Mermaid safety policy accepts flowcharts and class/sequence/state/ER UML', () => {
  for (const source of [notation, 'flowchart LR\nA --> B', 'classDiagram\nAuthor <|-- Agent', 'stateDiagram-v2\n[*] --> Ready', 'erDiagram\nAUTHOR ||--o{ ARTICLE : writes']) assert.doesNotThrow(() => validateMermaidSource(source));
});
test('diagram surfaces stay light with dark text and dark with light text, independently of code panels', () => {
  assert.equal(mermaidPanelColor('#ffffff', '#111111'), '#f1f1f1');
  assert.equal(mermaidPanelColor('#000000', '#f5f5f5'), '#0f0f0f');
});
test('Mermaid safety policy rejects overrides, empty/oversized input and resource/font loading', () => {
  for (const source of ['', '  ', '%%{init: {"securityLevel":"loose"}}%%\nflowchart LR\nA-->B', '---\nconfig:\n  themeCSS: bad\n---\nflowchart LR\nA-->B',
    'flowchart LR\nA@{img: "https://tracking.example/pixel.svg"}', 'flowchart LR\nA@{img: "h&#x74;tps&#58;//tracking.example/pixel.svg"}',
    'flowchart LR\nA@{img: "//tracking.example/pixel.svg"}', 'flowchart LR\nclassDef remote fill:url(https://tracking.example/image)',
    'flowchart LR\nclassDef remote font-family: tracking', 'flowchart LR\nA["data:text/html,bad"]', 'flowchart LR\nclassDef remote fill:u\\72l(bad)',
  ]) assert.throws(() => validateMermaidSource(source), Error, source);
  assert.throws(() => validateMermaidSource('x'.repeat(101), 100), /maxTextSize/);
});
test('the portal contains a real PlantUML export and its actual generator source', () => {
  const svg = readFileSync('content/diagrams/article-review.svg', 'utf8');
  assert.doesNotThrow(() => inspectDiagramSvg(svg));
  assert.match(svg, /plantuml|SRC=|Author/);
  assert.match(readFileSync('content/diagrams/article-review.puml', 'utf8'), /@startuml[\s\S]*@enduml/);
});
for (const mdx of [false, true]) test(`${mdx ? 'MDX' : 'Markdown'} Mermaid and PlantUML retain source, captions and version/locale-aware gated exports`, () => {
  const { root } = fixture(mdx);
  const output = JSON.parse(run(root, `import {loadArticle,getArticleSources,articleMarkdownExport} from ${moduleUrl('src/lib/article-loader.ts')}; import {buildCorpus} from ${moduleUrl('src/lib/corpus.ts')}; const article=getArticleSources()[0]; const doc=await loadArticle(article); console.log(JSON.stringify({html:doc.html,markdown:await articleMarkdownExport(article),corpus:await buildCorpus()}));`));
  assert.match(output.html, /data-docsy-mermaid/); assert.match(output.html, /Otter sequence/);
  assert.match(output.html, /Diagram source/); assert.match(output.html, /data-max-text-size="50000"/);
  assert.match(output.html, /data-docsy-diagram="review"/); assert.match(output.html, /download="uml.puml"/);
  assert.match(output.markdown, /```mermaid[\s\S]*Reader->>Docsy/); assert.match(output.markdown, /Editable PlantUML source/);
  assert.ok(!output.markdown.includes('base64,')); assert.ok(!output.markdown.includes('::plantuml'));
  assert.ok(output.corpus.some((entry: any) => entry.version === 'v1' && entry.locale === 'es' && entry.body.includes('otter')));
  const responses = JSON.parse(run(root, `import {GET as page} from ${moduleUrl('src/pages/agent/pages/[...path].json.ts')}; import {GET as search} from ${moduleUrl('src/pages/search-index.json.ts')}; const call=async(tiers=[])=>{const locals={docsyAccess:{authenticated:!!tiers.length,tiers}}; const response=await page({params:{path:'guides/architecture'},url:new URL('https://docs.example.test/docs/agent/pages/guides/architecture.json'),locals}); return {status:response.status,body:await response.text(),index:await (await search({locals})).text()}}; console.log(JSON.stringify([await call(),await call(['pro'])]));`));
  assert.equal(responses[0].status, 404); assert.doesNotMatch(responses[0].body + responses[0].index, /otter|sequenceDiagram|uml.puml/);
  assert.equal(responses[1].status, 200); assert.match(responses[1].body, /sequenceDiagram/); assert.match(responses[1].index, /otter/);
  assert.doesNotMatch(responses[1].body + responses[1].index, /base64,/);
});
test('Mermaid can be disabled or bounded through YAML without enabling executable MDX', () => {
  const { root, config } = fixture();
  const code = `import {loadArticle,getArticleSources} from ${moduleUrl('src/lib/article-loader.ts')}; console.log((await loadArticle(getArticleSources()[0])).html);`;
  config.content.mermaid = { enabled: false }; write(root, 'docsy.config.yaml', dump(config));
  assert.doesNotMatch(run(root, code), /data-docsy-mermaid/);
  config.content.mermaid = { enabled: true, maxTextSize: 100 }; write(root, 'docsy.config.yaml', dump(config));
  write(root, 'content/article.md', '```mermaid\nflowchart LR\nA[' + 'x'.repeat(101) + ']\n```');
  assert.throws(() => run(root, code), /maxTextSize/);
});
test('PlantUML enforces format/source matching, component enablement and native notation', () => {
  const { root, config } = fixture(true);
  const code = `import {loadArticle,getArticleSources} from ${moduleUrl('src/lib/article-loader.ts')}; await loadArticle(getArticleSources()[0]);`;
  config.content.components = ['drawio']; write(root, 'docsy.config.yaml', dump(config));
  assert.throws(() => run(root, code), /disabled/);
  delete config.content.components; config.content.diagrams.review.source = 'content/uml.drawio'; write(root, 'docsy.config.yaml', dump(config));
  assert.throws(() => run(root, code), /extension must match/);
  config.content.diagrams.review.source = 'content/uml.puml'; write(root, 'docsy.config.yaml', dump(config));
  write(root, 'content/uml.puml', 'not PlantUML'); assert.throws(() => run(root, code), /@startuml/);
  write(root, 'content/uml.puml', plantuml); write(root, 'content/article.mdx', '<Drawio src="review" />');
  assert.throws(() => run(root, code), /matching plantuml/);
});
test('PlantUML source is downloaded, never interpreted or included during article rendering', () => {
  const { root } = fixture();
  write(root, 'content/uml.puml', '@startuml\n!include /not-a-real-file\n@enduml\n');
  const output = run(root, `import {loadDiagram} from ${moduleUrl('src/lib/drawio.ts')}; console.log(loadDiagram('review').source.filename);`);
  assert.equal(output, 'uml.puml');
});
