import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { dump } from 'js-yaml';
import { inspectDiagramSvg, inspectDiagramPng } from '../src/lib/drawio';
import { embeddedImageUrl, mediaUrl } from '../src/lib/media-viewer-client';

const repo = process.cwd();
const directories: string[] = [];
const temp = () => { const root = mkdtempSync(join(tmpdir(), 'docsy-drawio-')); directories.push(root); return root; };
afterEach(() => { directories.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })); });
const svg = (body = '<rect width="100" height="60" fill="#fff"/><text x="10" y="30">Client</text>', attrs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" ${attrs}>${body}</svg>`;
const source = '<mxfile><diagram name="Architecture"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';
const write = (root: string, path: string, value: string | Buffer) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), value); };
const moduleUrl = (path: string) => JSON.stringify(new URL(`../${path}`, import.meta.url).href);
const run = (root: string, code: string) => execFileSync(process.execPath, ['--import', resolve(repo, 'node_modules/tsx/dist/loader.mjs'), '--input-type=module', '-e', code], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, DOCSY_CONFIG: 'docsy.config.yaml' } }).trim();
const fixture = (mdx = false) => {
  const root = temp();
  write(root, 'content/diagram.svg', svg()); write(root, 'content/diagram.drawio', source);
  write(root, `content/article.${mdx ? 'mdx' : 'md'}`, `## Technical architecture\n\n${mdx ? '<Drawio src="architecture" />' : '::drawio{src="architecture"}'}\n`);
  const config: any = {
    site: { name: 'Test', title: 'Docs', description: 'Test docs', origin: 'https://docs.example.test', basePath: '/docs', logo: 'assets/logo.svg' },
    home: { title: 'Docs', description: 'Test docs', primaryAction: { label: 'Guide', href: '/guides/architecture' } },
    content: { diagrams: { architecture: { image: 'content/diagram.svg', source: 'content/diagram.drawio', alt: 'Client calls the API', caption: 'A bounded local architecture diagram.' } }, articles: [{ slug: 'architecture', title: 'Architecture', source: `content/article.${mdx ? 'mdx' : 'md'}` }] },
    navigation: [], ingestion: { openapi: { enabled: false, source: 'unused.yaml', apiBaseUrl: 'https://api.example.test' } },
    access: { mode: 'locked', tiers: { pro: { label: 'Pro' } }, rules: [{ pattern: '/guides/architecture', tiers: ['pro'] }] },
  };
  write(root, 'docsy.config.yaml', dump(config)); return { root, config };
};
test('SVG diagrams preserve vector shapes, HTML labels, gradients and standard SVG doctype', () => {
  assert.deepEqual(inspectDiagramSvg(svg()), { width: 100, height: 60 });
  assert.doesNotThrow(() => inspectDiagramSvg(svg('<defs><linearGradient id="blue"><stop offset="0" stop-color="#09f"/></linearGradient></defs><rect fill="url(&quot;#blue&quot;)"/><foreignObject><div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial;">Label</div></foreignObject>')));
  assert.doesNotThrow(() => inspectDiagramSvg('<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' + svg()));
  assert.doesNotThrow(() => inspectDiagramSvg(svg('<style>@font-face {font-family: embedded; src: url("data:application/x-font-ttf;charset=utf-8;base64,AAEAAA==");}</style>')));
});
test('SVG diagrams reject active markup, handlers, external images/styles/fonts, XML entities and oversized geometry', () => {
  for (const bad of [
    svg('<script>alert(1)</script>'), svg('', 'onload="alert(1)"'), svg('<foreignObject><iframe src="https://evil.example"/></foreignObject>'),
    svg('<image href="https://tracking.example/pixel.png"/>'), svg('<style>@import "https://tracking.example/font.css";</style>'),
    svg('<style>@font-face {font-family: custom; src: url(https://tracking.example/font.woff)}</style>'),
    svg('<rect style="fill: url(https://tracking.example/a.svg)"/>'), svg('<a href="jav&#x61;script:alert(1)"><text>Bad</text></a>'),
    svg('<path marker-end="url(https://tracking.example/a.svg)"/>'), svg('<use href="#shape"/>', 'xml:base="https://tracking.example/"'),
    '<!DOCTYPE svg [<!ENTITY x "boom">]>' + svg(), '<?xml-stylesheet href="https://evil.example/a.css"?>' + svg(),
    svg().replace('100 60', '100000 100000'), svg() + svg(),
  ]) assert.throws(() => inspectDiagramSvg(bad), Error, bad.slice(0, 120));
});
test('PNG diagrams require a complete image signature and bounded dimensions', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Xy0AAAAASUVORK5CYII=', 'base64');
  assert.deepEqual(inspectDiagramPng(png), { width: 1, height: 1 });
  assert.throws(() => inspectDiagramPng(Buffer.from('<svg/>')));
  assert.throws(() => inspectDiagramPng(png.subarray(0, 24)));
  png.writeUInt32BE(40000, 16); assert.throws(() => inspectDiagramPng(png), /dimensions/);
});
for (const mdx of [false, true]) test(`${mdx ? 'MDX' : 'Markdown'} diagrams render previews/downloads and keep binary payloads out of agent exports`, () => {
  const { root } = fixture(mdx);
  const output = JSON.parse(run(root, `import {loadArticle,getArticleSources,articleMarkdownExport} from ${moduleUrl('src/lib/article-loader.ts')}; const a=getArticleSources()[0]; const doc=await loadArticle(a); console.log(JSON.stringify({html:doc.html,markdown:await articleMarkdownExport(a)}));`));
  assert.match(output.html, /data-docsy-diagram="architecture"/); assert.match(output.html, /data:image\/svg\+xml;base64,/);
  assert.match(output.html, /data:application\/octet-stream;base64,/); assert.match(output.html, /download="diagram.drawio"/);
  assert.match(output.markdown, /Client calls the API/); assert.match(output.markdown, /bounded local architecture/);
  assert.ok(!output.markdown.includes('base64,')); assert.ok(!output.markdown.includes('::drawio'));
  const auth = JSON.parse(run(root, `import {GET} from ${moduleUrl('src/pages/agent/pages/[...path].json.ts')}; const call=async(tiers=[])=>{const r=await GET({params:{path:'guides/architecture'},url:new URL('http://localhost/docs/agent/pages/guides/architecture.json'),locals:{docsyAccess:{authenticated:!!tiers.length,tiers}}});return {status:r.status,body:await r.text()}}; console.log(JSON.stringify([await call(),await call(['pro'])]));`));
  assert.equal(auth[0].status, 404); assert.ok(!auth[0].body.includes('Client calls'));
  assert.equal(auth[1].status, 200); assert.match(auth[1].body, /Client calls/); assert.ok(!auth[1].body.includes('base64,'));
});
test('YAML requires accessible local exports and supports preview-only diagrams', () => {
  const { root, config } = fixture();
  delete config.content.diagrams.architecture.source; write(root, 'docsy.config.yaml', dump(config));
  const code = `import {loadDiagram,drawioHtml} from ${moduleUrl('src/lib/drawio.ts')}; console.log(drawioHtml('architecture'));`;
  assert.ok(!run(root, code).includes('download='));
  config.content.diagrams.architecture.alt = ''; write(root, 'docsy.config.yaml', dump(config));
  assert.throws(() => run(root, code), /content\.diagrams\.architecture\.alt:/);
});
test('missing, external/symlinked, disabled and oversized diagram inputs fail closed', () => {
  const { root, config } = fixture(); const outside = temp(); write(outside, 'other.svg', svg());
  const code = `import {loadDiagram} from ${moduleUrl('src/lib/drawio.ts')}; loadDiagram('architecture');`;
  symlinkSync(join(outside, 'other.svg'), join(root, 'content/outside.svg'));
  config.content.diagrams.architecture.image = 'content/outside.svg'; write(root, 'docsy.config.yaml', dump(config));
  assert.throws(() => run(root, code), /stay inside/);
  config.content.diagrams.architecture.image = 'content/missing.svg'; write(root, 'docsy.config.yaml', dump(config));
  assert.throws(() => run(root, code), /Could not load draw.io/);
  config.content.diagrams.architecture.image = 'content/diagram.svg'; config.content.components = []; write(root, 'docsy.config.yaml', dump(config));
  assert.throws(() => run(root, code), /disabled/);
  delete config.content.components; write(root, 'docsy.config.yaml', dump(config)); write(root, 'content/diagram.svg', Buffer.alloc(5 * 1024 * 1024 + 1));
  assert.throws(() => run(root, code), /5 MiB/);
  assert.throws(() => run(root, code.replace("'architecture'", "'unknown'")), /Unknown draw.io/);
});
test('embedded diagram viewer accepts only bounded base64 images, not executable data or source downloads', () => {
  assert.equal(embeddedImageUrl('data:image/svg+xml;base64,PHN2Zy8+'), 'data:image/svg+xml;base64,PHN2Zy8+');
  for (const value of ['data:text/html;base64,PHNjcmlwdD4=', 'data:application/octet-stream;base64,YQ==', 'data:image/svg+xml,<svg/>', 'data:image/png;base64,!!!!', 'javascript:alert(1)']) assert.equal(embeddedImageUrl(value), null);
  assert.equal(mediaUrl('data:image/svg+xml;base64,PHN2Zy8+', 'https://example.test'), null);
});
