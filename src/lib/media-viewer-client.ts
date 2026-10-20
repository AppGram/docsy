import { fitImageScale, imageIsFitted, initImageZoom, MAX_IMAGE_SCALE } from './media-zoom-client';

type Media = HTMLImageElement | HTMLVideoElement;
type Entry = { media: Media; trigger: HTMLButtonElement; wrapper: HTMLElement; original: HTMLElement };
const controllers = new WeakMap<Document, () => void>();
const expandIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>';

// Only actual media URLs reach the viewer; never clone source HTML or handlers.
export function mediaUrl(value: string | null | undefined, base: string): string | null {
  if (!value?.trim()) return null;
  try { const url = new URL(value, base); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export const embeddedImageUrl = (value: string | null | undefined): string | null => value && value.length <= 8 * 1024 * 1024 && /^data:image\/(?:svg\+xml|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : null;

export function initMediaViewer(root: Document = document): () => void {
  controllers.get(root)?.();
  const dialog = root.querySelector<HTMLDialogElement>('.docs-media-viewer');
  if (!dialog || typeof dialog.showModal !== 'function') return () => {};
  const stage = dialog.querySelector<HTMLElement>('[data-media-stage]')!;
  const caption = dialog.querySelector<HTMLElement>('[data-media-caption]')!;
  const counter = dialog.querySelector<HTMLElement>('[data-media-count]')!;
  const error = dialog.querySelector<HTMLElement>('[data-media-error]')!;
  const closeButton = dialog.querySelector<HTMLButtonElement>('[data-media-close]')!;
  const previous = dialog.querySelector<HTMLButtonElement>('[data-media-previous]')!;
  const next = dialog.querySelector<HTMLButtonElement>('[data-media-next]')!;
  const zoom = dialog.querySelector<HTMLButtonElement>('[data-media-zoom]')!;
  const zoomControls = dialog.querySelector<HTMLElement>('[data-media-zoom-controls]')!;
  const zoomIn = dialog.querySelector<HTMLButtonElement>('[data-media-zoom-in]')!;
  const zoomOut = dialog.querySelector<HTMLButtonElement>('[data-media-zoom-out]')!;
  const scaleLabel = dialog.querySelector<HTMLElement>('[data-media-scale]')!;
  const originalLink = dialog.querySelector<HTMLAnchorElement>('[data-media-original]')!;
  const entries: Entry[] = [];
  const removeListeners: (() => void)[] = [];
  const listen = (target: EventTarget, type: string, callback: EventListener) => {
    target.addEventListener(type, callback);
    removeListeners.push(() => target.removeEventListener(type, callback));
  };
  let gallery: Entry[] = [];
  let index = 0;
  let opener: HTMLButtonElement | undefined;
  let overflow: string | undefined;
  let inlineVideo: HTMLVideoElement | undefined;
  let imageZoom: ReturnType<typeof initImageZoom> | undefined;
  const url = (value?: string | null) => mediaUrl(value, root.baseURI);
  const imageUrl = (media: Media) => url(media.currentSrc || media.getAttribute('src')) || (media.tagName === 'IMG' && media.hasAttribute('data-docsy-embedded-image') ? embeddedImageUrl(media.currentSrc || media.getAttribute('src')) : null);
  const clear = () => {
    imageZoom?.destroy(); imageZoom = undefined;
    const video = stage.querySelector('video');
    if (video) {
      video.pause();
      if (inlineVideo && video.readyState > 0 && Number.isFinite(video.currentTime)) inlineVideo.currentTime = video.currentTime;
      video.removeAttribute('src'); video.replaceChildren(); video.load();
    }
    inlineVideo = undefined;
    stage.replaceChildren();
  };
  const finish = () => {
    clear();
    if (overflow !== undefined) { root.documentElement.style.overflow = overflow; overflow = undefined; }
    opener?.focus({ preventScroll: true });
    opener = undefined;
  };
  const close = () => { if (dialog.open) dialog.close(); finish(); };
  const render = () => {
    clear(); error.hidden = true;
    const source = gallery[index].media;
    const isVideo = source.tagName === 'VIDEO';
    const currentUrl = imageUrl(source);
    const originalUrl = currentUrl || (isVideo ? [...source.querySelectorAll('source')].map((child) => url(child.getAttribute('src'))).find(Boolean) : null);
    originalLink.hidden = !originalUrl || originalUrl.startsWith('data:');
    if (originalUrl && !originalUrl.startsWith('data:')) originalLink.href = originalUrl; else originalLink.removeAttribute('href');
    const figure = source.closest('figure');
    const description = (figure?.querySelector('[data-diagram-caption]') || figure?.querySelector('figcaption'))?.textContent?.trim() || source.getAttribute('title') || source.getAttribute('alt') || source.getAttribute('aria-label') || '';
    caption.textContent = description;
    counter.textContent = (dialog.dataset.count || '{current} / {total}').replace('{current}', String(index + 1)).replace('{total}', String(gallery.length));
    previous.disabled = index === 0; next.disabled = index === gallery.length - 1;
    zoomControls.hidden = isVideo;
    zoomIn.disabled = true; zoomOut.disabled = true; zoom.disabled = true; scaleLabel.textContent = '—';
    const displayed = root.createElement(isVideo ? 'video' : 'img');
    const background = source.getAttribute('data-media-background');
    if (['light', 'dark', 'transparent'].includes(background || '')) displayed.setAttribute('data-media-background', background!);
    if (currentUrl) displayed.src = currentUrl;
    if (displayed.tagName === 'VIDEO') {
      const video = displayed as HTMLVideoElement;
      const inline = source as HTMLVideoElement;
      inlineVideo = inline;
      video.setAttribute('aria-label', description || dialog.dataset.openVideo || 'Video');
      // Pause the inline player and start the overlay at the same time position.
      const time = inline.currentTime;
      inline.pause();
      video.controls = true; video.playsInline = true; video.preload = 'metadata';
      video.muted = inline.muted; video.volume = inline.volume; video.playbackRate = inline.playbackRate;
      const poster = url(inline.getAttribute('poster')); if (poster) video.poster = poster;
      for (const child of inline.querySelectorAll('source, track')) {
        const src = url(child.getAttribute('src')); if (!src) continue;
        const clone = root.createElement(child.tagName.toLowerCase()); clone.setAttribute('src', src);
        for (const name of ['type', 'kind', 'srclang', 'label', 'default']) if (child.hasAttribute(name)) clone.setAttribute(name, child.getAttribute(name)!);
        video.append(clone);
      }
      video.addEventListener('loadedmetadata', () => {
        if (!stage.contains(video)) return;
        if (Number.isFinite(time) && time > 0) video.currentTime = time;
        const resolved = url(video.currentSrc); if (resolved) { originalLink.href = resolved; originalLink.hidden = false; }
      }, { once: true });
      // User chooses Play: opening a viewer never unexpectedly starts audio.
    } else (displayed as HTMLImageElement).alt = source.getAttribute('alt') || description;
    displayed.addEventListener('error', () => { if (stage.contains(displayed)) error.hidden = false; });
    if (isVideo) stage.append(displayed);
    else {
      const canvas = root.createElement('div'); canvas.className = 'docs-media-canvas';
      canvas.append(displayed); stage.append(canvas);
      imageZoom = initImageZoom(canvas, displayed as HTMLImageElement, (state) => {
        const fitted = imageIsFitted(state);
        zoom.disabled = false; zoomIn.disabled = state.scale >= MAX_IMAGE_SCALE; zoomOut.disabled = state.scale <= fitImageScale(state) + 0.00001;
        scaleLabel.textContent = `${Math.max(1, Math.round(state.scale * 100))}%`;
        const label = (fitted ? (state.scale < 1 ? dialog.dataset.zoomActual : dialog.dataset.zoomIn) : dialog.dataset.zoomFit) || '';
        zoom.setAttribute('aria-label', label); zoom.title = label; zoom.setAttribute('aria-pressed', String(!fitted));
      });
    }
  };
  const move = (delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= gallery.length) return;
    index = target; render();
    // A disabled previous/next button must not strand focus after navigation.
    if ((root.activeElement === next && next.disabled) || (root.activeElement === previous && previous.disabled)) closeButton.focus();
  };
  const open = (entry: Entry) => {
    gallery = entries.filter(({ media }) => media.getClientRects().length > 0);
    index = gallery.indexOf(entry); if (index < 0) return;
    opener = entry.trigger;
    render();
    dialog.showModal();
    overflow = root.documentElement.style.overflow;
    root.documentElement.style.overflow = 'hidden';
    closeButton.focus();
  };
  const candidates = root.querySelectorAll<Media>('.article-body img, .article-body video, .docs-content img[data-docsy-media], .docs-content video[data-docsy-media]');
  for (const media of candidates) {
    const isVideo = media.tagName === 'VIDEO';
    if (dialog.dataset[isVideo ? 'videos' : 'images'] === 'false') continue;
    // Never hijack links, cards, decorative logos, or explicitly excluded media.
    if (media.closest('a, button, [role="button"], [aria-hidden="true"], [data-docsy-media="off"], [data-docsy-media="false"], .cb, pre, code')) continue;
    if (media.hasAttribute('aria-hidden') && media.getAttribute('aria-hidden') !== 'false') continue;
    const width = Number(media.getAttribute('width')), height = Number(media.getAttribute('height'));
    if (!isVideo && !media.hasAttribute('data-docsy-embedded-image') && width > 0 && width <= 48 && height > 0 && height <= 48) continue;
    if (!imageUrl(media) && !(isVideo && [...media.querySelectorAll('source')].some((child) => url(child.getAttribute('src'))))) continue;
    const original = media.parentElement?.tagName === 'PICTURE' ? media.parentElement : media;
    const trigger = root.createElement('button'); trigger.type = 'button';
    const label = (isVideo ? dialog.dataset.openVideo : dialog.dataset.openImage) || 'Expand media';
    trigger.title = label;
    trigger.setAttribute('aria-label', [label, media.getAttribute('alt') || media.getAttribute('title') || media.getAttribute('aria-label')].filter(Boolean).join(': '));
    trigger.setAttribute('aria-haspopup', 'dialog');
    const mark = root.createElement('span'); mark.innerHTML = expandIcon; mark.setAttribute('aria-hidden', 'true');
    let wrapper: HTMLElement;
    if (isVideo) {
      wrapper = root.createElement('span'); wrapper.className = 'docs-media-inline';
      trigger.className = 'docs-media-expand-video';
      trigger.append(mark, root.createTextNode(label));
      original.replaceWith(wrapper); wrapper.append(original, trigger);
    } else {
      wrapper = trigger; trigger.className = 'docs-media-trigger'; mark.className = 'docs-media-expand-mark';
      original.replaceWith(wrapper); wrapper.append(original, mark);
    }
    const entry = { media, trigger, wrapper, original }; entries.push(entry);
    listen(trigger, 'click', () => open(entry));
  }
  listen(closeButton, 'click', close);
  listen(previous, 'click', () => move(-1)); listen(next, 'click', () => move(1));
  listen(zoom, 'click', () => imageZoom?.toggle());
  listen(zoomIn, 'click', () => imageZoom?.zoomIn()); listen(zoomOut, 'click', () => imageZoom?.zoomOut());
  listen(stage, 'click', (event) => {
    if (event.target === stage) close();
  });
  listen(dialog, 'cancel', (event) => { event.preventDefault(); close(); });
  listen(dialog, 'close', () => { if (!dialog.open) finish(); });
  listen(dialog, 'keydown', (event) => {
    const key = event as KeyboardEvent;
    if (key.key === 'Tab' && !key.altKey && !key.ctrlKey && !key.metaKey) {
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], video[controls]')].filter((element) => element.getClientRects().length > 0);
      const focused = controls.indexOf(root.activeElement as HTMLElement);
      const target = focused < 0 ? (key.shiftKey ? controls.length - 1 : 0) : (focused + (key.shiftKey ? -1 : 1) + controls.length) % controls.length;
      // Safari can skip buttons entirely depending on the OS keyboard setting.
      key.preventDefault(); controls[target]?.focus();
      return;
    }
    // Native video controls retain arrow-key seeking, and modified shortcuts stay native.
    if (key.altKey || key.ctrlKey || key.metaKey || (key.shiftKey && key.key !== '+') || (key.target as Element)?.closest('video, input, textarea, select')) return;
    if (imageZoom) {
      if (['+', '=', '-', '0', '1', 'f'].includes(key.key)) {
        key.preventDefault(); key.stopPropagation();
        if (key.key === '+' || key.key === '=') imageZoom.zoomIn();
        else if (key.key === '-') imageZoom.zoomOut();
        else if (key.key === '1') imageZoom.actualSize();
        else imageZoom.fit();
        return;
      }
      if (!imageIsFitted(imageZoom.state) && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key.key)) {
        key.preventDefault(); key.stopPropagation(); imageZoom.pan(key.key === 'ArrowLeft' ? 60 : key.key === 'ArrowRight' ? -60 : 0, key.key === 'ArrowUp' ? 60 : key.key === 'ArrowDown' ? -60 : 0); return;
      }
    }
    if (key.key === 'ArrowLeft' || key.key === 'ArrowRight') { key.preventDefault(); key.stopPropagation(); move(key.key === 'ArrowLeft' ? -1 : 1); }
  });
  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    close(); removeListeners.forEach((remove) => remove());
    entries.forEach(({ wrapper, original }) => wrapper.replaceWith(original));
    if (controllers.get(root) === cleanup) controllers.delete(root);
  };
  controllers.set(root, cleanup);
  return cleanup;
}
