import test from 'node:test';
import assert from 'node:assert/strict';
import { clampImageView, fitImageScale, imageIsFitted, initImageZoom, pinchImage, zoomImageAt, type ImageView } from '../src/lib/media-zoom-client';

const initial = (): ImageView => ({ width: 2000, height: 1200, viewportWidth: 1000, viewportHeight: 600, scale: 0.5, x: 0, y: 0 });
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} != ${expected}`);

class Events {
  listeners = new Map<string, Set<Function>>();
  options = new Map<string, any>();
  addEventListener(name: string, callback: Function, options: any) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name)!.add(callback); this.options.set(name, options); }
  removeEventListener(name: string, callback: Function) { this.listeners.get(name)?.delete(callback); }
  emit(type: string, values: any = {}) {
    const event = { type, pointerId: 1, pointerType: 'mouse', button: 0, clientX: 520, clientY: 400, deltaMode: 0, deltaY: 0, prevented: false, preventDefault() { this.prevented = true; }, ...values };
    for (const callback of this.listeners.get(type) ?? []) callback(event);
    return event;
  }
}
function fixture() {
  const frames = new Map<number, Function>(); let nextFrame = 1;
  const observers: any[] = [];
  const view = Object.assign(new Events(), {
    time: 100,
    requestAnimationFrame(callback: Function) { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelAnimationFrame(id: number) { frames.delete(id); },
    performance: { now: () => view.time },
    ResizeObserver: class {
      disconnected = false;
      constructor(public callback: () => void) { observers.push(this); }
      observe() {} disconnect() { this.disconnected = true; }
    },
  });
  const attributes = new Set<string>(); const captured = new Set<number>();
  const canvas = Object.assign(new Events(), {
    clientWidth: 1000, clientHeight: 600, ownerDocument: { defaultView: view },
    getBoundingClientRect() { return { left: 20, top: 100, width: this.clientWidth, height: this.clientHeight }; },
    toggleAttribute(name: string, enabled: boolean) { enabled ? attributes.add(name) : attributes.delete(name); },
    removeAttribute(name: string) { attributes.delete(name); },
    setPointerCapture(id: number) { captured.add(id); }, hasPointerCapture(id: number) { return captured.has(id); }, releasePointerCapture(id: number) { captured.delete(id); },
  });
  const image = Object.assign(new Events(), { naturalWidth: 2000, naturalHeight: 1200, style: {} as any, draggable: true });
  const states: ImageView[] = [];
  const init = () => initImageZoom(canvas as unknown as HTMLElement, image as unknown as HTMLImageElement, (state) => states.push(state));
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback()); };
  return { canvas, image, view, attributes, captured, states, observers, frames, init, flush };
}

test('fit retains aspect ratio, does not upscale small images, and bounds zoom and pan', () => {
  const base = initial(); near(fitImageScale(base), 0.5); assert.ok(imageIsFitted(base));
  near(fitImageScale({ ...base, width: 128, height: 128 }), 1);
  const large = clampImageView({ ...base, scale: 80, x: 100000, y: -100000 });
  assert.equal(large.scale, 8); assert.equal(large.x, 7500); assert.equal(large.y, -4500);
  const fitted = clampImageView({ ...base, scale: 0.01, x: 1000, y: -1000 });
  assert.equal(fitted.scale, 0.5); assert.equal(Math.abs(fitted.x), 0); assert.equal(Math.abs(fitted.y), 0);
});
test('zoom keeps the detail under the pointer stationary rather than jumping to top-left', () => {
  const before = initial(), point = { x: 100, y: 50 };
  const after = zoomImageAt(before, 1, point);
  near((point.x - before.x) / before.scale, (point.x - after.x) / after.scale);
  near((point.y - before.y) / before.scale, (point.y - after.y) / after.scale);
  assert.equal(before.x, 0); // Geometry helpers do not mutate caller state.
});
test('pinching scales around the midpoint and follows two-finger translation', () => {
  const next = pinchImage(initial(), [{ x: -100, y: 0 }, { x: 100, y: 0 }], [{ x: -200, y: 40 }, { x: 200, y: 40 }]);
  near(next.scale, 1); near(next.x, 0); near(next.y, 40);
});
test('image canvas fits on open, renders a centered GPU transform and reports real percentages', () => {
  const page = fixture(); const zoom = page.init();
  assert.equal(zoom.state.scale, 0.5); assert.equal(page.image.style.width, '2000px');
  assert.equal(page.image.style.transform, 'translate(-500px, -300px) scale(0.5)');
  assert.equal(page.image.draggable, false);
  zoom.zoomIn(); near(zoom.state.scale, 0.75); assert.ok(page.attributes.has('data-zoomed'));
  zoom.actualSize(); assert.equal(zoom.state.scale, 1);
  zoom.fit(); near(zoom.state.scale, 0.5); assert.ok(!page.attributes.has('data-zoomed'));
  zoom.toggle(); near(zoom.state.scale, 1); zoom.toggle(); near(zoom.state.scale, 0.5);
});
test('wheel zoom is local, pointer-centered and clamps instead of scrolling the page', () => {
  const page = fixture(); const zoom = page.init();
  const event = page.canvas.emit('wheel', { deltaY: -100, clientX: 620, clientY: 450 });
  assert.equal(event.prevented, true); assert.equal(page.canvas.options.get('wheel').passive, false);
  assert.ok(zoom.state.scale > 0.5); assert.ok(zoom.state.x < 0); assert.ok(zoom.state.y < 0);
  for (let i = 0; i < 30; i++) page.canvas.emit('wheel', { deltaY: -1000 });
  near(zoom.state.scale, 8);
  for (let i = 0; i < 30; i++) page.canvas.emit('wheel', { deltaY: 1000, deltaMode: 1 });
  near(zoom.state.scale, 0.5);
});
test('dragging pans without a click-to-fit jump and keeps the image in bounds', () => {
  const page = fixture(); const zoom = page.init(); zoom.actualSize();
  page.canvas.emit('pointerdown'); assert.ok(page.captured.has(1));
  page.canvas.emit('pointermove', { clientX: 620, clientY: 360 });
  near(zoom.state.x, 100); near(zoom.state.y, -40); assert.ok(page.attributes.has('data-dragging'));
  page.canvas.emit('pointerup'); assert.ok(!page.captured.has(1)); assert.ok(!page.attributes.has('data-dragging'));
  page.canvas.emit('click'); near(zoom.state.scale, 1); // A completed drag does not toggle zoom.
  zoom.pan(100000, -100000); near(zoom.state.x, 500); near(zoom.state.y, -300);
  page.canvas.emit('pointermove', { clientX: 900 }); near(zoom.state.x, 500);
});
test('two touch pointers pinch smoothly and cancellation releases capture', () => {
  const page = fixture(); const zoom = page.init();
  page.canvas.emit('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 470 });
  page.canvas.emit('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 570 });
  page.canvas.emit('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 370 });
  page.canvas.emit('pointermove', { pointerId: 2, pointerType: 'touch', clientX: 670 });
  near(zoom.state.scale, 1.5); near(zoom.state.x, 0);
  page.canvas.emit('pointercancel', { pointerId: 1 }); page.canvas.emit('pointercancel', { pointerId: 2 });
  assert.equal(page.captured.size, 0); assert.ok(!page.attributes.has('data-dragging'));
});
test('double-click/double-tap toggle fit and detail without duplicate synthetic mouse toggles', () => {
  const page = fixture(); const zoom = page.init();
  const tap = () => { page.canvas.emit('pointerdown', { pointerType: 'touch' }); page.canvas.emit('pointerup', { pointerType: 'touch' }); };
  tap(); page.view.time = 200; tap(); near(zoom.state.scale, 1);
  page.canvas.emit('dblclick'); near(zoom.state.scale, 1);
  page.view.time = 1000; page.canvas.emit('dblclick'); near(zoom.state.scale, 0.5);
  page.canvas.emit('dblclick'); near(zoom.state.scale, 1);
});
test('resizing refits fitted images but preserves inspection zoom, and late image loads initialize', () => {
  const page = fixture(); const zoom = page.init();
  page.canvas.clientWidth = 500; page.canvas.clientHeight = 300; page.observers[0].callback(); near(zoom.state.scale, 0.25);
  zoom.actualSize(); page.canvas.clientWidth = 800; page.view.emit('resize'); near(zoom.state.scale, 1);
  const late = fixture(); late.image.naturalWidth = 0; const loading = late.init(); assert.equal(loading.state.width, 0);
  late.image.naturalWidth = 2000; late.image.emit('load'); near(loading.state.scale, 0.5);
});
test('canvas cleanup removes wheel/pointer handlers, observer, captures and pending animation frames', () => {
  const page = fixture(); const zoom = page.init(); page.canvas.emit('pointerdown');
  zoom.destroy(); zoom.destroy(); assert.equal(page.captured.size, 0); assert.equal(page.frames.size, 0);
  assert.ok(page.observers[0].disconnected);
  for (const handlers of [...page.canvas.listeners.values(), ...page.image.listeners.values(), ...page.view.listeners.values()]) assert.equal(handlers.size, 0);
  const before = zoom.state.scale; page.canvas.emit('wheel', { deltaY: -100 }); zoom.zoomIn(); near(zoom.state.scale, before);
});
