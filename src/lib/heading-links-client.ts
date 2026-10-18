const hashIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16M3 15h16M11 3 7 21M17 3l-4 18"/></svg>';
const checkIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const controllers = new WeakMap<Document, () => void>();

export function sectionUrl(page: string, id: string): string {
  const url = new URL(page);
  url.hash = encodeURIComponent(id);
  return url.href;
}

export async function copySectionLink(text: string, root: Document = document): Promise<boolean> {
  try {
    const clipboard = root.defaultView?.navigator.clipboard;
    if (clipboard?.writeText) { await clipboard.writeText(text); return true; }
  } catch { /* Some self-hosted origins or browser policies disable Clipboard API. */ }
  const focused = root.activeElement as HTMLElement | null;
  const selection = root.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
  const field = root.createElement('textarea');
  field.value = text; field.readOnly = true; field.tabIndex = -1;
  field.setAttribute('aria-hidden', 'true');
  field.style.cssText = 'position:fixed;inset:0 auto auto 0;width:1px;height:1px;padding:0;border:0;opacity:0;';
  root.body.append(field);
  try {
    field.focus({ preventScroll: true }); field.select();
    return Boolean(root.execCommand?.('copy'));
  } catch { return false; }
  finally {
    field.remove(); focused?.focus({ preventScroll: true });
    if (selection) { selection.removeAllRanges(); ranges.forEach((range) => selection.addRange(range)); }
  }
}

export function initHeadingLinks(root: Document = document): () => void {
  controllers.get(root)?.();
  const view = root.defaultView;
  if (!view || root.body.dataset.headingLinks === 'false') return () => {};
  const label = root.body.dataset.copySectionLabel || 'Copy link to section';
  const copied = root.body.dataset.sectionCopiedLabel || 'Link copied';
  const failed = root.body.dataset.sectionFailedLabel || 'Could not copy link';
  const status = root.createElement('span');
  status.className = 'docs-heading-copy-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  root.body.append(status);
  const entries: { heading: HTMLElement; button: HTMLButtonElement; click: () => Promise<void>; hadClass: boolean }[] = [];
  const timers = new Set<number>();
  let disposed = false;
  for (const heading of root.querySelectorAll<HTMLElement>('.docs-content :is(h2, h3, h4, h5, h6)')) {
    if (heading.closest('a, button, [data-heading-links="off"]')) continue;
    // Reuse the exact existing deep-link targets; do not change published slugs.
    const section = heading.id ? heading : heading.matches('.ep-head h2') ? heading.closest<HTMLElement>('.ep[id]') : heading.matches('.sdk-category > h2') ? heading.parentElement : heading.matches('.sdk-item-head h3') ? heading.closest<HTMLElement>('.sdk-item[id]') : null;
    if (!section?.id) continue;
    const text = heading.textContent?.trim() || section.id;
    const button = root.createElement('button'); button.type = 'button'; button.className = 'docs-heading-link';
    const reset = () => {
      button.innerHTML = hashIcon; button.removeAttribute('data-copied');
      button.title = `${label}: ${text}`; button.setAttribute('aria-label', `${label}: ${text}`);
    };
    reset();
    let pending = false;
    let timer: number | undefined;
    const click = async () => {
      if (pending) return;
      pending = true;
      status.textContent = '';
      const success = await copySectionLink(sectionUrl(view.location.href, section.id), root);
      pending = false;
      if (disposed) return;
      if (timer !== undefined) { view.clearTimeout(timer); timers.delete(timer); }
      const result = success ? copied : failed;
      button.innerHTML = success ? checkIcon : hashIcon; button.toggleAttribute('data-copied', success);
      button.title = result; button.setAttribute('aria-label', `${result}: ${text}`);
      status.textContent = `${result}: ${text}`;
      timer = view.setTimeout(() => { if (timer !== undefined) timers.delete(timer); reset(); }, 1800); timers.add(timer);
    };
    button.addEventListener('click', click);
    const hadClass = heading.classList.contains('docs-linked-heading');
    heading.classList.add('docs-linked-heading'); heading.append(button);
    entries.push({ heading, button, click, hadClass });
  }
  const cleanup = () => {
    if (disposed) return; disposed = true;
    timers.forEach((timer) => view.clearTimeout(timer)); status.remove();
    entries.forEach(({ heading, button, click, hadClass }) => {
      button.removeEventListener('click', click); button.remove();
      if (!hadClass) heading.classList.remove('docs-linked-heading');
    });
    if (controllers.get(root) === cleanup) controllers.delete(root);
  };
  controllers.set(root, cleanup);
  return cleanup;
}
