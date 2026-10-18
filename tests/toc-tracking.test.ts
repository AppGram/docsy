import test from 'node:test';
import assert from 'node:assert/strict';
import { activeTocSection, initTocTracking } from '../src/lib/toc-client';

class Events {
  listeners = new Map<string, Set<Function>>();
  addEventListener(type: string, callback: Function) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(callback);
  }
  removeEventListener(type: string, callback: Function) { this.listeners.get(type)?.delete(callback); }
  emit(type: string, target: any = null) { for (const callback of this.listeners.get(type) ?? []) callback({ target }); }
}

function fixture() {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  const observers: { callback: () => void; disconnected: boolean }[] = [];
  const view = Object.assign(new Events(), {
    scrollY: 0,
    innerHeight: 800,
    requestAnimationFrame: (callback: FrameRequestCallback) => { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelAnimationFrame: (id: number) => { frames.delete(id); },
    ResizeObserver: class {
      disconnected = false;
      constructor(public callback: () => void) { observers.push(this); }
      observe() {}
      disconnect() { this.disconnected = true; }
    },
  });
  const rail = { clientHeight: 400, scrollTop: 0, getBoundingClientRect: () => ({ top: 72, bottom: 472 }) };
  const header = { bottom: 56, getBoundingClientRect() { return { bottom: this.bottom }; } };
  const targets = [100, 1400, 3000].map((top, index) => ({
    id: ['intro', 'long-section', 'last'][index], top, visible: true,
    getClientRects() { return this.visible ? [{}] : []; },
    getBoundingClientRect() { return { top: this.top - view.scrollY }; },
  }));
  const links = targets.map((target, index) => ({
    attributes: new Map([['href', `#${target.id}`]]), top: [80, 330, 700][index],
    getAttribute(name: string) { return this.attributes.get(name) ?? null; },
    setAttribute(name: string, value: string) { this.attributes.set(name, value); },
    removeAttribute(name: string) { this.attributes.delete(name); },
    closest() { return rail; },
    getBoundingClientRect() { return { top: this.top - rail.scrollTop, bottom: this.top - rail.scrollTop + 20 }; },
  }));
  const content = {};
  const doc = Object.assign(new Events(), {
    defaultView: view,
    scrollingElement: { scrollHeight: 6000 },
    documentElement: { scrollHeight: 6000 },
    querySelectorAll: () => links,
    getElementById: (id: string) => targets.find((target) => target.id === id),
    querySelector: (selector: string) => selector === '.docs-topbar' ? header : selector === '.docs-content' ? content : null,
  });
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback(0)); };
  const init = () => { const cleanup = initTocTracking(doc as unknown as Document); flush(); return cleanup; };
  const active = () => links.filter((link) => link.getAttribute('aria-current') === 'location').map((link) => link.getAttribute('href'));
  const scroll = (y: number) => { view.scrollY = y; view.emit('scroll'); flush(); };
  return { doc, view, rail, header, links, targets, observers, frames, flush, init, active, scroll };
}

test('tracking uses section starts rather than visible-heading intersection ratios', () => {
  assert.equal(activeTocSection([{ id: 'intro', top: -1800 }, { id: 'next', top: 500 }], 96), 'intro');
  assert.equal(activeTocSection([{ id: 'intro', top: -1800 }, { id: 'next', top: 90 }], 96), 'next');
  assert.equal(activeTocSection([{ id: 'intro', top: 300 }, { id: 'next', top: 900 }], 96), 'intro');
  assert.equal(activeTocSection([], 96), null);
  assert.equal(activeTocSection([{ id: 'missing', top: Number.NaN }], 96), null);
});
test('tracking handles nested/reordered headings without mutating source order', () => {
  const sections = [{ id: 'third', top: 700 }, { id: 'first', top: -300 }, { id: 'nested', top: 80 }];
  assert.equal(activeTocSection(sections, 96), 'nested');
  assert.equal(sections[0].id, 'third');
  assert.equal(activeTocSection(sections, 96, true), 'third');
});
test('exactly one item follows scrolling down and back through long sections', () => {
  const page = fixture(); page.init();
  assert.deepEqual(page.active(), ['#intro']);
  page.scroll(1100); assert.deepEqual(page.active(), ['#intro']);
  page.scroll(1350); assert.deepEqual(page.active(), ['#long-section']);
  page.scroll(2940); assert.deepEqual(page.active(), ['#last']);
  page.scroll(400); assert.deepEqual(page.active(), ['#intro']);
});
test('initial deep links, hash changes and bfcache restores use the current scroll position', () => {
  const page = fixture(); page.view.scrollY = 1400; page.init();
  assert.deepEqual(page.active(), ['#long-section']);
  page.view.scrollY = 3000; page.view.emit('hashchange'); page.flush();
  assert.deepEqual(page.active(), ['#last']);
  page.view.scrollY = 0; page.view.emit('pageshow'); page.flush();
  assert.deepEqual(page.active(), ['#intro']);
});
test('hidden tab and accordion targets are ignored, then restored after interaction', () => {
  const page = fixture(); page.targets[1].visible = false; page.view.scrollY = 1400; page.init();
  assert.deepEqual(page.active(), ['#intro']);
  page.targets[1].visible = true; page.doc.emit('toggle'); page.flush();
  assert.deepEqual(page.active(), ['#long-section']);
  page.targets[1].visible = false;
  page.doc.emit('click', { closest: () => ({}) }); page.flush();
  assert.deepEqual(page.active(), ['#intro']);
});
test('image loads, layout changes and resized header offsets recalculate tracking', () => {
  const page = fixture(); page.view.scrollY = 1300; page.init();
  assert.deepEqual(page.active(), ['#intro']);
  page.header.bottom = 100; page.view.emit('resize'); page.flush();
  assert.deepEqual(page.active(), ['#long-section']);
  page.targets[1].top = 1800; page.doc.emit('load'); page.flush();
  assert.deepEqual(page.active(), ['#intro']);
  page.targets[1].top = 1400; page.observers[0].callback(); page.flush();
  assert.deepEqual(page.active(), ['#long-section']);
});
test('the last short section becomes active at page bottom, not on a non-scrollable initial page', () => {
  const page = fixture(); page.doc.scrollingElement.scrollHeight = 3200; page.init();
  page.scroll(2400); assert.deepEqual(page.active(), ['#last']);
  page.doc.scrollingElement.scrollHeight = 600; page.scroll(0);
  assert.deepEqual(page.active(), ['#intro']);
});
test('a long TOC reveals its active link without moving the article viewport', () => {
  const page = fixture(); page.init(); page.scroll(3000);
  assert.equal(page.view.scrollY, 3000);
  assert.equal(page.rail.scrollTop, 260);
  page.scroll(0); assert.equal(page.view.scrollY, 0); assert.equal(page.rail.scrollTop, 0);
});
test('scroll events coalesce into one animation frame and reinitialization removes old listeners', () => {
  const page = fixture(); const firstCleanup = page.init();
  for (let i = 0; i < 10; i++) page.view.emit('scroll');
  assert.equal(page.frames.size, 1);
  const cleanup = page.init();
  firstCleanup();
  assert.equal(page.observers[0].disconnected, true);
  assert.equal(page.view.listeners.get('scroll')?.size, 1);
  cleanup();
  assert.equal(page.view.listeners.get('scroll')?.size, 0);
  assert.equal(page.doc.listeners.get('click')?.size, 0);
  assert.equal(page.observers[1].disconnected, true);
  page.init(); page.init();
  assert.equal(page.view.listeners.get('scroll')?.size, 1);
});
test('malformed/unknown anchors and empty TOCs do not throw', () => {
  const page = fixture(); page.links[0].setAttribute('href', '#%oops');
  page.links[1].setAttribute('href', '#unknown');
  page.init(); assert.deepEqual(page.active(), ['#last']);
  page.links.length = 0; assert.doesNotThrow(() => page.init());
});
