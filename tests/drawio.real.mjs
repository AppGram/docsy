import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { inspectDiagramPng, inspectDiagramSvg } from '../src/lib/drawio.ts';

// Public upstream artifacts are tested in memory, not redistributed in Docsy.
const commit = '321f82a19dd7f619bddfe5e0866bf548d98bd8f4';
const base = `https://raw.githubusercontent.com/jgraph/drawio-integration/${commit}/examples/`;
const get = async (path) => {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200);
  const body = await response.text(); assert.ok(Buffer.byteLength(body) <= 5 * 1024 * 1024);
  return body;
};
const svg = await get('inline/inline.drawio.svg');
const html = await get('localstorage/localstorage.html');
const pngMatch = html.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
assert.ok(pngMatch, 'Upstream PNG fixture has changed');
const png = Buffer.from(pngMatch[1], 'base64');
const results = [
  { format: 'SVG', source: base + 'inline/inline.drawio.svg', ...inspectDiagramSvg(svg), sha256: createHash('sha256').update(svg).digest('hex') },
  { format: 'PNG', source: base + 'localstorage/localstorage.html', ...inspectDiagramPng(png), sha256: createHash('sha256').update(png).digest('hex') },
];
mkdirSync('.docsy/proofs', { recursive: true });
writeFileSync('.docsy/proofs/drawio.json', JSON.stringify({ result: 'passed', upstreamCommit: commit, results }, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
