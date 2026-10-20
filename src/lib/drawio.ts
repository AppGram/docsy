import { readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, extname, isAbsolute, relative } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { XMLParser } from 'fast-xml-parser';
import { SyntaxValidator } from 'fast-xml-validator';
import { docsyConfig, resolveSource } from '../config';

export const MAX_DIAGRAM_BYTES = 5 * 1024 * 1024;
const readLocal = (source: string): Buffer => {
  const project = realpathSync(process.cwd());
  const file = realpathSync(resolveSource(source));
  const path = relative(project, file);
  if (path.startsWith('..') || isAbsolute(path)) throw new Error('Diagram files must stay inside the project.');
  const stat = statSync(file);
  if (!stat.isFile() || stat.size > MAX_DIAGRAM_BYTES) throw new Error('Diagram files must be regular files no larger than 5 MiB.');
  const bytes = readFileSync(file);
  if (bytes.length > MAX_DIAGRAM_BYTES) throw new Error('Diagram file exceeds 5 MiB.');
  return bytes;
};
const parseXml = (source: string) => {
  // Accept the standard SVG doctype, without resolving or loading its DTD.
  const xml = source.replace(/<!DOCTYPE\s+svg\s+PUBLIC\s+"-\/\/W3C\/\/DTD SVG 1\.1\/\/EN"\s+"https?:\/\/www\.w3\.org\/Graphics\/SVG\/1\.1\/DTD\/svg11\.dtd"\s*>/i, '');
  if (/<!\s*(?:DOCTYPE|ENTITY)|<\?xml-stylesheet/i.test(xml)) throw new Error('Diagram XML must not contain entities, custom DTDs or stylesheets.');
  SyntaxValidator.validate(xml, { multipleRoots: false });
  return new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', ignoreDeclaration: true, parseTagValue: false }).parse(xml);
};
const size = (width: number, height: number) => {
  if (![width, height].every((value) => Number.isFinite(value) && value > 0 && value <= 32768) || width * height > 64_000_000) throw new Error('Diagram dimensions must be positive and no larger than 64 megapixels.');
  return { width, height };
};
const safeCss = (value: string, embeddedFonts = false) => {
  const fail = () => { throw new Error('Diagram styles must not load external resources or fonts. Embed images when exporting from draw.io.'); };
  if (/@import|expression\s*\(|behavior\s*:|-moz-binding|\\/i.test(value) || (!embeddedFonts && /@font-face/i.test(value))) fail();
  const urls = /url\s*\(([^)]*)\)/gi;
  for (const match of value.matchAll(urls)) {
    const url = match[1].trim();
    const embeddedFont = embeddedFonts && /^(['"]?)data:(?:font\/(?:ttf|otf|woff2?)|application\/(?:x-font-(?:ttf|woff)|font-woff2?));(?:charset=utf-8;)?base64,[A-Za-z0-9+/]+={0,2}\1$/i.test(url);
    if (!/^(['"]?)#[a-zA-Z_][\w:.-]*\1$/.test(url) && !embeddedFont) fail();
  }
  if (/url\s*\(/i.test(value.replace(urls, ''))) fail();
};
const svgTags = new Set('svg g defs path rect circle ellipse line polyline polygon text tspan textPath title desc switch foreignObject clipPath mask marker pattern linearGradient radialGradient stop image use a style filter feGaussianBlur feOffset feBlend feColorMatrix feComposite feFlood feMerge feMergeNode div span p br b strong i em u s font sub sup table tbody tr td hr'.toLowerCase().split(' '));
export function inspectDiagramSvg(source: string, depth = 0): { width: number; height: number } {
  if (depth > 3 || Buffer.byteLength(source) > MAX_DIAGRAM_BYTES) throw new Error('Nested/oversized SVG diagram.');
  const document = parseXml(source);
  const root = document.svg;
  if (!root || typeof root !== 'object' || root['@xmlns'] !== 'http://www.w3.org/2000/svg') throw new Error('Diagram preview must be an SVG document.');
  let nodes = 0;
  const visit = (node: any, tag = '') => {
    if (++nodes > 100000) throw new Error('SVG diagram is too complex.');
    if (Array.isArray(node)) { node.forEach((child) => visit(child, tag)); return; }
    if (!node || typeof node !== 'object') { if (tag.toLowerCase() === 'style') safeCss(String(node), true); return; }
    for (const [key, raw] of Object.entries(node)) {
      if (key === '#text') { if (tag.toLowerCase() === 'style') safeCss(String(raw), true); continue; }
      if (key.startsWith('@')) {
        const name = key.slice(1).toLowerCase().split(':').pop()!;
        const value = String(raw);
        if (/^on/.test(name)) throw new Error('SVG diagram event handlers are not allowed.');
        if (key.toLowerCase() === '@xml:base') throw new Error('SVG diagrams must not rebase resource URLs.');
        if (name === 'style') safeCss(value);
        if (/^(?:fill|stroke|filter|mask|clip-path|cursor|marker-start|marker-mid|marker-end)$/.test(name)) safeCss(value);
        if (name === 'href' || name === 'src') {
          if (value.startsWith('#')) continue;
          if (tag.toLowerCase() === 'a' && /^https?:\/\//i.test(value)) continue;
          const image = value.match(/^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,([a-zA-Z0-9+/]+={0,2})$/);
          if (!image) throw new Error('SVG images must be embedded data, not external URLs. Enable image embedding in draw.io.');
          if (image[1] === 'svg+xml') inspectDiagramSvg(Buffer.from(image[2], 'base64').toString('utf8'), depth + 1);
        }
      } else {
        if (!svgTags.has(key.toLowerCase())) throw new Error(`Unsupported/active SVG diagram element: ${key}`);
        visit(raw, key);
      }
    }
  };
  visit(root, 'svg');
  const viewBox = String(root['@viewBox'] ?? '').trim().split(/[\s,]+/).map(Number);
  const numeric = (value: unknown) => /^(?:\d+\.?\d*|\.\d+)(?:px)?$/.test(String(value)) ? Number.parseFloat(String(value)) : NaN;
  return viewBox.length === 4 && viewBox.every(Number.isFinite) ? size(viewBox[2], viewBox[3]) : size(numeric(root['@width']), numeric(root['@height']));
}
export function inspectDiagramPng(bytes: Buffer): { width: number; height: number } {
  if (bytes.length < 45 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii', 12, 16) !== 'IHDR' || bytes.toString('ascii', bytes.length - 8, bytes.length - 4) !== 'IEND') throw new Error('Diagram preview is not a complete PNG export.');
  return size(bytes.readUInt32BE(16), bytes.readUInt32BE(20));
}
export function diagramDescription(id: string): string {
  if (!Object.hasOwn(docsyConfig.content.diagrams, id)) throw new Error(`Unknown draw.io diagram: ${id}`);
  const config = docsyConfig.content.diagrams[id];
  if (!config) throw new Error(`Unknown draw.io diagram: ${id}`);
  return `Diagram: ${config.alt}${config.caption ? `\n\n${config.caption}` : ''}${config.source ? '\n\nEditable draw.io source is available from the article’s diagram card.' : ''}`;
}
export function loadDiagram(id: string) {
  if (!docsyConfig.content.components.includes('drawio')) throw new Error('Article component drawio is disabled in YAML.');
  if (!Object.hasOwn(docsyConfig.content.diagrams, id)) throw new Error(`Unknown draw.io diagram: ${id}`);
  const config = docsyConfig.content.diagrams[id];
  if (!config) throw new Error(`Unknown draw.io diagram: ${id}`);
  try {
    const bytes = readLocal(config.image);
    const svg = extname(config.image).toLowerCase() === '.svg';
    const dimensions = svg ? inspectDiagramSvg(bytes.toString('utf8')) : inspectDiagramPng(bytes);
    let source: { url: string; filename: string } | undefined;
    if (config.source) {
      const bytes = readLocal(config.source);
      const xml = parseXml(bytes.toString('utf8'));
      if (!xml.mxfile && !xml.mxGraphModel) throw new Error('Source must be a native draw.io mxfile or mxGraphModel.');
      source = { url: `data:application/octet-stream;base64,${bytes.toString('base64')}`, filename: basename(config.source) };
    }
    return { ...config, ...dimensions, imageUrl: `data:image/${svg ? 'svg+xml' : 'png'};base64,${bytes.toString('base64')}`, source };
  } catch (error) { throw new Error(`Could not load draw.io diagram "${id}": ${error instanceof Error ? error.message : error}`); }
}
export const Drawio = ({ src }: { src: string }) => {
  const diagram = loadDiagram(src);
  return h('figure', { className: 'docsy-diagram', 'data-docsy-diagram': src, 'data-diagram-background': diagram.background, 'data-diagram-description': diagramDescription(src) },
    h('div', { className: 'docsy-diagram-preview' }, h('img', { src: diagram.imageUrl, alt: diagram.alt, width: diagram.width, height: diagram.height, loading: 'lazy', decoding: 'async', 'data-docsy-media': 'true', 'data-docsy-embedded-image': 'true', 'data-media-background': diagram.background })),
    h('figcaption', null, h('span', { 'data-diagram-caption': true }, diagram.caption || diagram.alt), diagram.source ? h('a', { href: diagram.source.url, download: diagram.source.filename, className: 'docsy-diagram-source', title: diagram.source.filename, 'aria-label': `${diagram.sourceLabel}: ${diagram.source.filename}` }, diagram.sourceLabel, h('span', { 'aria-hidden': true }, ' ↓')) : null));
};
export const drawioHtml = (src: string): string => renderToStaticMarkup(h(Drawio, { src }));

// Agent exports describe diagrams without embedding megabytes of image/source data.
export function diagramExportTree(tree: any): any {
  const output = structuredClone(tree);
  const visit = (node: any) => {
    const id = node.properties?.['dataDocsyDiagram'] ?? node.properties?.['data-docsy-diagram'];
    if (node.tagName === 'figure' && typeof id === 'string') {
      node.tagName = 'p'; node.properties = {};
      node.children = [{ type: 'text', value: diagramDescription(id) }];
    } else node.children?.forEach(visit);
  };
  visit(output);
  return output;
}
