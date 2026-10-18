import test from 'node:test';
import assert from 'node:assert/strict';
import { copySectionLink, initHeadingLinks, sectionUrl } from '../src/lib/heading-links-client';

function fixture() {
  const elements: any[] = [];
  const timers = new Map<number, Function>();
  let nextTimer = 1;
  const writes: string[] = [];
  const root: any = {
    body: { dataset: {}, append(node: any) { elements.push(node); } },
    defaultView: {
      location: { href: 'https://example.test/docs/versions/v1/es/guide/?q=api#old' },
      navigator: { clipboard: { async writeText(value: string) { writes.push(value); } } },
      setTimeout(callback: Function) { const id = nextTimer++; timers.set(id, callback); return id; },
      clearTimeout(id: number) { timers.delete(id); },
    },
    activeElement: null,
    getSelection: () => null,
    execCommand: () => true,
    createElement(tagName: string) {
      const attributes = new Map();
      const listeners = new Map();
      const node: any = {
        tagName, style: {}, textContent: '', title: '', innerHTML: '',
        setAttribute(name: string, value: string) { attributes.set(name, value); },
        getAttribute(name: string) { return attributes.get(name); },
        removeAttribute(name: string) { attributes.delete(name); },
        toggleAttribute(name: string, value: boolean) { value ? attributes.set(name, '') : attributes.delete(name); },
        addEventListener(name: string, listener: Function) { listeners.set(name, listener); },
        removeEventListener(name: string) { listeners.delete(name); },
        async click() { await listeners.get('click')?.(); },
        focus() { root.activeElement = node; }, select() {},
        remove() { node.removed = true; const index = elements.indexOf(node); if (index >= 0) elements.splice(index, 1); },
      };
      return node;
    },
  };
  const heading = (id: string, text = id, type = '', container: any = null, excluded = false) => {
    const classes = new Set<string>();
    return {
      id, textContent: text, buttons: [] as any[], parentElement: container,
      classList: { add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name), contains: (name: string) => classes.has(name) },
      matches: (selector: string) => selector === type,
      closest: (selector: string) => selector.includes('[data-heading-links') ? excluded : container,
      append(node: any) { this.buttons.push(node); },
    };
  };
  const headings = [heading('setup', 'Set up **safely**'), heading('', 'GET users', '.ep-head h2', { id: 'get-users' }), heading('', 'Types', '.sdk-category > h2', { id: 'types' }), heading('', 'Client', '.sdk-item-head h3', { id: 'sdk-client' }), heading('', 'Unanchored'), heading('excluded', 'Linked card', '', null, true)];
  root.querySelectorAll = () => headings;
  const init = () => initHeadingLinks(root);
  const flush = () => { [...timers.values()].forEach((callback) => callback()); timers.clear(); };
  return { root, headings, elements, timers, writes, init, flush };
}

test('section URLs preserve version, locale and query while replacing/encoding fragments', () => {
  assert.equal(sectionUrl('https://test/docs/versions/v1/es/guide/?q=api#old', 'new'), 'https://test/docs/versions/v1/es/guide/?q=api#new');
  const url = new URL(sectionUrl('https://test/docs/guide/', 'café / C# 100%'));
  assert.equal(decodeURIComponent(url.hash.slice(1)), 'café / C# 100%');
});
test('hover copy controls use existing article/API/SDK targets and do not rewrite navigation', async () => {
  const page = fixture(); page.init();
  for (const heading of page.headings.slice(0, 4)) assert.equal(heading.buttons.length, 1);
  for (const heading of page.headings.slice(4)) assert.equal(heading.buttons.length, 0);
  for (const [i, fragment] of ['setup', 'get-users', 'types', 'sdk-client'].entries()) {
    await page.headings[i].buttons[0].click();
    assert.ok(page.writes.at(-1)?.endsWith(`#${fragment}`));
    assert.ok(page.headings[i].buttons[0].getAttribute('aria-label').startsWith('Link copied:'));
  }
  assert.ok(page.root.defaultView.location.href.endsWith('#old'));
  page.flush(); assert.match(page.headings[0].buttons[0].getAttribute('aria-label'), /^Copy link to section:/);
});
test('clipboard denial uses a temporary fallback field and restores focus and text selection', async () => {
  const page = fixture(); page.root.defaultView.navigator.clipboard.writeText = async () => { throw new Error('Denied'); };
  const focus = { focus() { page.root.activeElement = focus; } }; page.root.activeElement = focus;
  const saved = {}; const ranges: any[] = [];
  page.root.getSelection = () => ({ rangeCount: 1, getRangeAt: () => ({ cloneRange: () => saved }), removeAllRanges: () => ranges.length = 0, addRange: (range: any) => ranges.push(range) });
  let payload = '';
  page.root.execCommand = (name: string) => { assert.equal(name, 'copy'); payload = page.elements[0].value; return true; };
  assert.equal(await copySectionLink('https://test/docs#heading', page.root), true);
  assert.equal(payload, 'https://test/docs#heading'); assert.equal(page.elements.length, 0);
  assert.equal(page.root.activeElement, focus); assert.deepEqual(ranges, [saved]);
});
test('copy failure is announced honestly when both clipboard methods are unavailable', async () => {
  const page = fixture(); delete (page.root.defaultView.navigator as any).clipboard; page.root.execCommand = () => false;
  page.init(); await page.headings[0].buttons[0].click();
  assert.match(page.headings[0].buttons[0].getAttribute('aria-label'), /^Could not copy link:/);
  assert.equal(page.headings[0].buttons[0].getAttribute('data-copied'), undefined);
  assert.equal(page.elements.length, 1); // Only the live status, no leaked textarea.
});
test('cleanup is idempotent, cancels feedback and does not duplicate controls on reinitialization', async () => {
  const page = fixture(); const first = page.init(); await page.headings[0].buttons[0].click();
  assert.equal(page.timers.size, 1);
  const cleanup = page.init(); first();
  assert.equal(page.timers.size, 0); assert.equal(page.elements.length, 1);
  assert.equal(page.headings[0].buttons.filter((button) => !button.removed).length, 1);
  cleanup(); cleanup(); assert.equal(page.elements.length, 0);
  assert.equal(page.headings[0].classList.contains('docs-linked-heading'), false);
});
test('YAML disable leaves headings untouched and configured labels are respected', async () => {
  const page = fixture(); page.root.body.dataset.headingLinks = 'false'; page.init();
  assert.equal(page.elements.length, 0); assert.equal(page.headings[0].buttons.length, 0);
  page.root.body.dataset.headingLinks = 'true'; page.root.body.dataset.copySectionLabel = 'Copiar enlace'; page.root.body.dataset.sectionCopiedLabel = 'Enlace copiado';
  page.init(); assert.match(page.headings[0].buttons[0].getAttribute('aria-label'), /^Copiar enlace:/);
  await page.headings[0].buttons[0].click(); assert.match(page.headings[0].buttons[0].getAttribute('aria-label'), /^Enlace copiado:/);
});
test('a completed asynchronous copy does not mutate a disposed controller', async () => {
  const page = fixture(); let resolve!: () => void;
  page.root.defaultView.navigator.clipboard.writeText = () => new Promise<void>((done) => { resolve = done; });
  const cleanup = page.init(); const copying = page.headings[0].buttons[0].click(); cleanup(); resolve(); await copying;
  assert.equal(page.timers.size, 0); assert.equal(page.elements.length, 0);
});
