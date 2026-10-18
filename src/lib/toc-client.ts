export type TocSection = { id: string; top: number };

export function activeTocSection(sections: TocSection[], offset: number, atBottom = false): string | null {
  const ordered = sections.filter((section) => Number.isFinite(section.top)).sort((a, b) => a.top - b.top);
  if (!ordered.length) return null;
  if (atBottom) return ordered[ordered.length - 1].id;
  let active = ordered[0].id;
  for (const section of ordered) {
    if (section.top > offset + 1) break;
    active = section.id;
  }
  return active;
}

const controllers = new WeakMap<Document, () => void>();

export function initTocTracking(root: Document = document): () => void {
  controllers.get(root)?.();
  const view = root.defaultView;
  const entries = [...root.querySelectorAll<HTMLAnchorElement>('[data-docs-toc] a[href^="#"]')].flatMap((link) => {
    let id: string;
    try { id = decodeURIComponent(link.getAttribute('href')!.slice(1)); } catch { return []; }
    const target = id && root.getElementById(id);
    return target ? [{ id, link, target }] : [];
  });
  if (!view || !entries.length) return () => {};

  let frame = 0;
  let current: string | null | undefined;
  const update = () => {
    frame = 0;
    // Compare section starts, not intersection ratios: long API/SDK sections
    // must stay active even when their heading is well above the viewport.
    const sections = entries.filter(({ target }) => target.getClientRects().length > 0).map(({ id, target }) => ({ id, top: target.getBoundingClientRect().top }));
    const headerBottom = root.querySelector('.docs-topbar')?.getBoundingClientRect().bottom ?? 56;
    const height = root.scrollingElement?.scrollHeight ?? root.documentElement.scrollHeight;
    const atBottom = view.scrollY > 0 && view.scrollY + view.innerHeight >= height - 2;
    const active = activeTocSection(sections, Math.max(0, headerBottom) + 40, atBottom);
    if (active === current) return;
    current = active;
    for (const { id, link } of entries) {
      if (id === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
    const link = entries.find((entry) => entry.id === active)?.link;
    const rail = link?.closest<HTMLElement>('.docs-toc-rail');
    if (!link || !rail || rail.clientHeight === 0) return;
    const bounds = rail.getBoundingClientRect();
    const item = link.getBoundingClientRect();
    // Scroll only the rail; scrollIntoView here can move the article as well.
    if (item.top < bounds.top + 12) rail.scrollTop = Math.max(0, rail.scrollTop - (bounds.top + 12 - item.top));
    else if (item.bottom > bounds.bottom - 12) rail.scrollTop += item.bottom - bounds.bottom + 12;
  };
  const schedule = () => { if (!frame) frame = view.requestAnimationFrame(update); };
  const onClick = (event: Event) => {
    // A tab switch can replace headings without changing the article's height.
    if ((event.target as Element | null)?.closest?.('.docsy-tab-list')) schedule();
  };
  view.addEventListener('scroll', schedule, { passive: true });
  view.addEventListener('resize', schedule);
  view.addEventListener('hashchange', schedule);
  view.addEventListener('pageshow', schedule);
  root.addEventListener('toggle', schedule, true);
  root.addEventListener('load', schedule, true);
  root.addEventListener('click', onClick);
  const observer = view.ResizeObserver ? new view.ResizeObserver(schedule) : undefined;
  const content = root.querySelector('.docs-content');
  if (content) observer?.observe(content);
  const header = root.querySelector('.docs-topbar');
  if (header) observer?.observe(header);
  const cleanup = () => {
    if (frame) view.cancelAnimationFrame(frame);
    observer?.disconnect();
    view.removeEventListener('scroll', schedule);
    view.removeEventListener('resize', schedule);
    view.removeEventListener('hashchange', schedule);
    view.removeEventListener('pageshow', schedule);
    root.removeEventListener('toggle', schedule, true);
    root.removeEventListener('load', schedule, true);
    root.removeEventListener('click', onClick);
    if (controllers.get(root) === cleanup) controllers.delete(root);
  };
  controllers.set(root, cleanup);
  schedule();
  return cleanup;
}
