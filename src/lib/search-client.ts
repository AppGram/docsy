import { searchRecords, type SearchRecord } from './search';
export function initSearch() {
  const modal = document.getElementById('docs-search-modal');
  const field = document.getElementById('docs-search-field') as HTMLInputElement | null;
  const results = document.getElementById('docs-search-results');
  const trigger = document.getElementById('docs-search-trigger');
  const scrim = document.getElementById('docs-search-scrim');
  if (!modal || !field || !results || !trigger || !scrim || document.body.dataset.searchEnabled === 'false') return;
  let index: SearchRecord[] | undefined; let active = 0;
  let loading: Promise<void> | undefined;
  const hint = (value: string) => { results.replaceChildren(); const p = document.createElement('p'); p.className = 'docs-search-hint'; p.textContent = value; results.append(p); };
  const hits = () => [...results.querySelectorAll<HTMLAnchorElement>('.docs-search-hit')];
  const setActive = (index: number) => {
    const items = hits(); if (!items.length) return;
    active = (index + items.length) % items.length;
    items.forEach((item, i) => item.classList.toggle('is-active', i === active));
    items[active].scrollIntoView({ block: 'nearest' });
  };
  const render = () => {
    const query = field.value.trim();
    if (!query) return hint(results.dataset.emptyHint || 'Start typing to search.');
    if (!index) return hint(results.dataset.loading || 'Loading index…');
    const matches = searchRecords(index, query, { version: document.body.dataset.docsVersion, locale: document.body.dataset.docsLocale, limit: Number(document.body.dataset.searchLimit || 30) });
    if (!matches.length) return hint(`${results.dataset.empty || 'No results'}: ${query}`);
    results.replaceChildren(); active = 0;
    for (const [i, entry] of matches.entries()) {
      const link = document.createElement('a'); link.className = `docs-search-hit${i === 0 ? ' is-active' : ''}`; link.href = entry.url;
      const main = document.createElement('div'); main.className = 'docs-search-hit-main';
      const badge = document.createElement('span'); badge.className = entry.type === 'api' ? 'docs-search-method' : 'docs-search-badge'; badge.textContent = entry.method || (entry.type === 'sdk' ? entry.kind || 'SDK' : results.dataset.pageLabel || 'Page');
      const title = document.createElement('span'); title.className = 'docs-search-hit-title'; title.textContent = entry.title;
      const excerpt = document.createElement('span'); excerpt.className = 'docs-search-sub'; excerpt.textContent = entry.excerpt || entry.group;
      main.append(badge, title); link.append(main, excerpt); results.append(link);
      link.addEventListener('mousemove', () => { if (active !== i) setActive(i); });
    }
  };
  const close = () => { modal.hidden = true; document.body.style.overflow = ''; trigger.focus(); };
  const open = async () => {
    modal.hidden = false; document.body.style.overflow = 'hidden'; field.value = ''; field.focus(); render();
    loading ??= fetch(document.body.dataset.searchIndex!).then((response) => { if (!response.ok) throw new Error('Index unavailable'); return response.json(); }).then((data) => { index = data.entries; }).catch(() => { loading = undefined; hint(results.dataset.error || 'Search could not be loaded. Close and retry.'); });
    await loading; if (index) render();
  };
  trigger.addEventListener('click', open); scrim.addEventListener('click', close);
  field.addEventListener('input', render);
  document.addEventListener('keydown', (event) => {
    if (document.querySelector('.docs-media-viewer[open]')) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); modal.hidden ? void open() : close(); return; }
    if (modal.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(active + (event.key === 'ArrowDown' ? 1 : -1)); }
    if (event.key === 'Enter' && hits()[active]) { event.preventDefault(); const focused = event.target instanceof HTMLAnchorElement ? event.target : hits()[active]; focused.click(); }
    if (event.key === 'Tab') {
      const first = field; const last = hits().at(-1) ?? field;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
}
