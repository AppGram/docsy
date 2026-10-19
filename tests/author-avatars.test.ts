import test from 'node:test';
import assert from 'node:assert/strict';
import { initAuthorAvatars } from '../src/lib/author-avatars-client';
import { readFileSync } from 'node:fs';

test('the bundled unknown-author placeholder has no fixed palette and follows theme tokens', () => {
  const svg = readFileSync(new URL('../public/assets/authors/unknown.svg', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/styles/article-credits.css', import.meta.url), 'utf8');
  assert.match(svg, /fill="none"/); assert.match(svg, /stroke="currentColor"/);
  assert.doesNotMatch(svg, /#[\da-f]{3,8}\b/i);
  assert.match(css, /\.article-author-avatar--placeholder[^}]*var\(--ink\)[^}]*var\(--paper\)/);
  assert.match(css, /\.article-author-placeholder[^}]*background: currentColor;[^}]*mask: var\(--author-placeholder\)/);
});

test('failed profile images reveal the local fallback without retrying remote requests', () => {
  const image = () => {
    const listeners: Record<string, () => void> = {};
    return { dataset: {} as Record<string, string>, hidden: false, complete: false, naturalWidth: 0, listeners,
      addEventListener: (name: string, handler: () => void) => { assert.equal(listeners[name], undefined); listeners[name] = handler; } };
  };
  const healthy = image(), broken = image(), pending = image();
  healthy.complete = true; healthy.naturalWidth = 80; broken.complete = true;
  const root = { querySelectorAll: (selector: string) => { assert.equal(selector, 'img[data-author-avatar]'); return [healthy, broken, pending]; } } as unknown as Pick<Document, 'querySelectorAll'>;
  initAuthorAvatars(root); initAuthorAvatars(root);
  assert.equal(healthy.hidden, false); assert.equal(broken.hidden, true); assert.equal(pending.hidden, false);
  pending.listeners.error(); assert.equal(pending.hidden, true);
});
