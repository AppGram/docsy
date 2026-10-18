export function initRichComponents() {
  const groups = [...document.querySelectorAll<HTMLElement>('.docsy-tabs')];
  const select = (group: HTMLElement, index: number, persist = true) => {
    const panels = [...group.querySelectorAll<HTMLElement>(':scope > .docsy-tab')];
    const buttons = [...group.querySelectorAll<HTMLButtonElement>(':scope > .docsy-tab-list > button')];
    panels.forEach((panel, i) => { panel.hidden = i !== index; });
    buttons.forEach((button, i) => { button.setAttribute('aria-selected', String(i === index)); button.tabIndex = i === index ? 0 : -1; });
    const sync = group.dataset.sync;
    if (persist && sync) {
      const label = panels[index]?.dataset.label;
      try { localStorage.setItem(`docsy-tabs:${document.body.dataset.docsBase}:${sync}`, label || ''); } catch {}
      for (const other of groups.filter((candidate) => candidate !== group && candidate.dataset.sync === sync)) {
        const match = [...other.querySelectorAll<HTMLElement>(':scope > .docsy-tab')].findIndex((panel) => panel.dataset.label === label);
        if (match >= 0) select(other, match, false);
      }
    }
  };
  groups.forEach((group, groupIndex) => {
    const panels = [...group.querySelectorAll<HTMLElement>(':scope > .docsy-tab')];
    const list = document.createElement('div');
    list.className = 'docsy-tab-list'; list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', panels.map((panel) => panel.dataset.label).join(', '));
    panels.forEach((panel, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.setAttribute('role', 'tab'); button.textContent = panel.dataset.label || 'Tab';
      button.id = `docsy-tab-${groupIndex}-${index}`; panel.id = `docsy-panel-${groupIndex}-${index}`;
      button.setAttribute('aria-controls', panel.id); panel.setAttribute('aria-labelledby', button.id);
      panel.setAttribute('role', 'tabpanel'); panel.tabIndex = 0;
      button.addEventListener('click', () => select(group, index));
      button.addEventListener('keydown', (event) => {
        const direction = document.documentElement.dir === 'rtl' ? -1 : 1;
        const delta = event.key === 'ArrowRight' ? direction : event.key === 'ArrowLeft' ? -direction : 0;
        const target = event.key === 'Home' ? 0 : event.key === 'End' ? panels.length - 1 : (index + delta + panels.length) % panels.length;
        if (!delta && !['Home', 'End'].includes(event.key)) return;
        event.preventDefault(); select(group, target); (list.children[target] as HTMLButtonElement).focus();
      });
      list.append(button);
    });
    group.prepend(list); group.dataset.enhanced = 'true';
    let chosen = 0;
    try {
      const saved = group.dataset.sync && localStorage.getItem(`docsy-tabs:${document.body.dataset.docsBase}:${group.dataset.sync}`);
      chosen = Math.max(0, panels.findIndex((panel) => panel.dataset.label === saved));
    } catch {}
    select(group, chosen, false);
  });
  const revealHash = () => {
    let id: string;
    try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
    const target = id && document.getElementById(id);
    if (!target) return;
    let ancestor: HTMLElement | null = target;
    while (ancestor) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
      if (ancestor.classList.contains('docsy-tab')) {
        const group = ancestor.parentElement;
        if (group?.classList.contains('docsy-tabs')) select(group, [...group.querySelectorAll<HTMLElement>(':scope > .docsy-tab')].indexOf(ancestor), false);
      }
      ancestor = ancestor.parentElement;
    }
    target.scrollIntoView({ block: 'start' });
  };
  revealHash(); window.addEventListener('hashchange', revealHash);
}
