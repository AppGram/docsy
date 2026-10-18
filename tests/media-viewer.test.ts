import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaUrl, initMediaViewer } from '../src/lib/media-viewer-client';
import { extractHtml } from '../src/lib/html-content';
import { byteRange } from '../scripts/lib/http-range.mjs';

test('media viewer resolves local/remote media without allowing executable or empty URLs', () => {
  const base = 'https://example.test/docs/guides/media/';
  assert.equal(mediaUrl('/docs/assets/demo.svg', base), 'https://example.test/docs/assets/demo.svg');
  assert.equal(mediaUrl('../../assets/demo.webm', base), 'https://example.test/docs/assets/demo.webm');
  assert.equal(mediaUrl('https://media.example.test/demo.mp4', base), 'https://media.example.test/demo.mp4');
  for (const value of ['', '  ', null, undefined, 'javascript:alert(1)', 'java\nscript:bad()', 'data:image/svg+xml,bad', 'file:///tmp/private', 'vbscript:bad()', 'blob:https://example.test/id']) assert.equal(mediaUrl(value, base), null);
});
test('missing or unsupported native dialogs leave media unmodified', () => {
  for (const dialog of [null, {}]) {
    let queries = 0;
    const root = { querySelector: () => dialog, querySelectorAll: () => { queries++; return []; } } as unknown as Document;
    assert.doesNotThrow(() => initMediaViewer(root)()); assert.equal(queries, 0);
  }
});
test('media sources, posters and caption tracks participate in existing link validation', () => {
  const result = extractHtml('<video src="/demo.mp4" poster="/poster.png"><source src="/demo.webm"><track src="/captions.vtt"></video>');
  assert.deepEqual(result.links, ['/demo.mp4', '/poster.png', '/demo.webm', '/captions.vtt']);
});
test('native media seeking supports bounded, open-ended and suffix byte ranges', () => {
  assert.deepEqual(byteRange('bytes=0-1', 100), { start: 0, end: 1 });
  assert.deepEqual(byteRange('bytes=20-', 100), { start: 20, end: 99 });
  assert.deepEqual(byteRange('bytes=-20', 100), { start: 80, end: 99 });
  assert.deepEqual(byteRange('bytes=90-900', 100), { start: 90, end: 99 });
  assert.deepEqual(byteRange('bytes=-900', 100), { start: 0, end: 99 });
  for (const value of ['bytes=100-', 'bytes=50-20', 'bytes=-0', 'bytes=-', 'bytes=9007199254740992-', 'bytes=invalid']) assert.equal(byteRange(value, 100), 'unsatisfiable');
  assert.equal(byteRange('bytes=0-0', 0), 'unsatisfiable');
  for (const value of [undefined, '', 'items=0-1', 'bytes=0-1,5-6']) assert.equal(byteRange(value, 100), null);
});
