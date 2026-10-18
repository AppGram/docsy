export type ImageView = { width: number; height: number; viewportWidth: number; viewportHeight: number; scale: number; x: number; y: number };
type Point = { x: number; y: number };
export const MAX_IMAGE_SCALE = 8;
export const fitImageScale = (view: ImageView) => Math.min(1, view.viewportWidth / Math.max(1, view.width), view.viewportHeight / Math.max(1, view.height));
export const imageIsFitted = (view: ImageView) => Math.abs(view.scale - fitImageScale(view)) < 0.00001;

export function clampImageView(view: ImageView): ImageView {
  const scale = Math.max(fitImageScale(view), Math.min(MAX_IMAGE_SCALE, view.scale));
  const maxX = Math.max(0, (view.width * scale - view.viewportWidth) / 2);
  const maxY = Math.max(0, (view.height * scale - view.viewportHeight) / 2);
  return { ...view, scale, x: Math.max(-maxX, Math.min(maxX, view.x)), y: Math.max(-maxY, Math.min(maxY, view.y)) };
}

// Points are relative to the viewport center. Keep the image detail beneath the
// pointer stationary while scaling, except where an image edge needs clamping.
export function zoomImageAt(view: ImageView, scale: number, point: Point = { x: 0, y: 0 }): ImageView {
  const next = Math.max(fitImageScale(view), Math.min(MAX_IMAGE_SCALE, scale));
  const ratio = next / Math.max(0.000001, view.scale);
  return clampImageView({ ...view, scale: next, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio });
}

export function pinchImage(view: ImageView, before: Point[], after: Point[]): ImageView {
  const distance = (points: Point[]) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  const middle = (points: Point[]) => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
  const old = middle(before), next = middle(after);
  const zoomed = zoomImageAt(view, view.scale * distance(after) / Math.max(1, distance(before)), old);
  return clampImageView({ ...zoomed, x: zoomed.x + next.x - old.x, y: zoomed.y + next.y - old.y });
}

export function initImageZoom(canvas: HTMLElement, image: HTMLImageElement, changed: (state: ImageView) => void) {
  const view = canvas.ownerDocument.defaultView!;
  let state: ImageView = { width: 0, height: 0, viewportWidth: 0, viewportHeight: 0, scale: 1, x: 0, y: 0 };
  let disposed = false;
  let frame = 0;
  let tap: { time: number; point: Point } | undefined;
  let singleStart: Point | undefined;
  let moved = false;
  let suppressDoubleClickUntil = -1;
  const pointers = new Map<number, Point>();
  const removers: (() => void)[] = [];
  const listen = (target: EventTarget, name: string, callback: EventListener, options?: AddEventListenerOptions) => {
    target.addEventListener(name, callback, options);
    removers.push(() => target.removeEventListener(name, callback, options));
  };
  const render = () => {
    image.style.width = `${state.width}px`; image.style.height = `${state.height}px`;
    image.style.transform = `translate(${state.x - state.width * state.scale / 2}px, ${state.y - state.height * state.scale / 2}px) scale(${state.scale})`;
    canvas.toggleAttribute('data-zoomed', !imageIsFitted(state));
    changed({ ...state });
  };
  const update = (next: ImageView) => { if (!disposed && state.width > 0) { state = clampImageView(next); render(); } };
  const fit = () => update({ ...state, scale: fitImageScale(state), x: 0, y: 0 });
  const scaleTo = (scale: number, point?: Point) => update(zoomImageAt(state, scale, point));
  const toggle = (point?: Point) => imageIsFitted(state) ? scaleTo(Math.max(1, state.scale * 2), point) : fit();
  const measure = () => {
    if (disposed || !image.naturalWidth || !image.naturalHeight || !canvas.clientWidth || !canvas.clientHeight) return;
    const fitted = state.width === 0 || imageIsFitted(state);
    state = { ...state, width: image.naturalWidth, height: image.naturalHeight, viewportWidth: canvas.clientWidth, viewportHeight: canvas.clientHeight };
    if (fitted) state = { ...state, scale: fitImageScale(state), x: 0, y: 0 };
    state = clampImageView(state); render();
  };
  const point = (event: MouseEvent | PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
  };
  listen(canvas, 'wheel', (event) => {
    const wheel = event as WheelEvent;
    if (!state.width) return;
    wheel.preventDefault();
    const pixels = wheel.deltaY * (wheel.deltaMode === 1 ? 16 : wheel.deltaMode === 2 ? state.viewportHeight : 1);
    scaleTo(state.scale * Math.exp(-Math.max(-200, Math.min(200, pixels)) * 0.003), point(wheel));
  }, { passive: false });
  listen(canvas, 'dblclick', (event) => { event.preventDefault(); if (view.performance.now() > suppressDoubleClickUntil) toggle(point(event as MouseEvent)); });
  listen(canvas, 'pointerdown', (event) => {
    const pointer = event as PointerEvent;
    if (pointer.button !== 0 || !state.width) return;
    pointer.preventDefault();
    pointers.set(pointer.pointerId, point(pointer));
    if (pointers.size === 1) { singleStart = point(pointer); moved = false; }
    else { moved = true; tap = undefined; }
    canvas.toggleAttribute('data-dragging', !imageIsFitted(state));
    try { canvas.setPointerCapture(pointer.pointerId); } catch { /* A pointer may already have ended. */ }
  });
  listen(canvas, 'pointermove', (event) => {
    const pointer = event as PointerEvent;
    const previous = pointers.get(pointer.pointerId); if (!previous) return;
    const before = [...pointers.values()].slice(0, 2);
    const current = point(pointer); pointers.set(pointer.pointerId, current);
    if (singleStart && Math.hypot(current.x - singleStart.x, current.y - singleStart.y) > 4) moved = true;
    if (pointers.size > 1) update(pinchImage(state, before, [...pointers.values()].slice(0, 2)));
    else update({ ...state, x: state.x + current.x - previous.x, y: state.y + current.y - previous.y });
    canvas.toggleAttribute('data-dragging', !imageIsFitted(state));
  });
  const release = (event: Event) => {
    const pointer = event as PointerEvent;
    if (!pointers.has(pointer.pointerId)) return;
    const current = pointers.get(pointer.pointerId)!;
    pointers.delete(pointer.pointerId);
    try { if (canvas.hasPointerCapture(pointer.pointerId)) canvas.releasePointerCapture(pointer.pointerId); } catch {}
    canvas.toggleAttribute('data-dragging', pointers.size > 0 && !imageIsFitted(state));
    if (pointer.type === 'pointerup' && pointer.pointerType === 'touch' && !moved && pointers.size === 0) {
      const time = view.performance.now();
      if (tap && time - tap.time < 320 && Math.hypot(current.x - tap.point.x, current.y - tap.point.y) < 24) { toggle(current); tap = undefined; suppressDoubleClickUntil = time + 500; }
      else tap = { time, point: current };
    }
  };
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(canvas, name, release);
  listen(image, 'load', measure); listen(view, 'resize', measure);
  const observer = view.ResizeObserver ? new view.ResizeObserver(measure) : undefined;
  observer?.observe(canvas);
  image.draggable = false;
  measure(); frame = view.requestAnimationFrame(() => { frame = 0; measure(); });
  return {
    get state() { return { ...state }; },
    fit, toggle,
    zoomIn: () => scaleTo(state.scale * 1.5),
    zoomOut: () => scaleTo(state.scale / 1.5),
    actualSize: () => scaleTo(1),
    pan: (x: number, y: number) => update({ ...state, x: state.x + x, y: state.y + y }),
    destroy() {
      if (disposed) return; disposed = true;
      if (frame) view.cancelAnimationFrame(frame);
      observer?.disconnect(); removers.forEach((remove) => remove());
      const active = [...pointers.keys()]; pointers.clear();
      active.forEach((id) => { try { if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id); } catch {} });
      canvas.removeAttribute('data-dragging'); canvas.removeAttribute('data-zoomed');
    },
  };
}
