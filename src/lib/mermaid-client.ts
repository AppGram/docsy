import type { MermaidConfig } from 'mermaid';
import { validateMermaidSource } from './mermaid-policy';
import { initMediaViewer } from './media-viewer-client';

const controllers = new WeakMap<Document, () => void>();
const MAX_SVG_BYTES = 5 * 1024 * 1024;

// Diagrams become inert image documents, not arbitrary SVG inserted into the
// article. Defense in depth also rejects external resources in renderer output.
export function mermaidImage(svg: string, root: Document = document): { src: string; width: number; height: number } {
  const bytes = new TextEncoder().encode(svg);
  if (bytes.length > MAX_SVG_BYTES || /<!DOCTYPE|<\?xml-stylesheet/i.test(svg)) throw new Error('Invalid or oversized Mermaid SVG.');
  const Parser = root.defaultView!.DOMParser;
  const document = new Parser().parseFromString(svg, 'image/svg+xml');
  const image = document.documentElement;
  if (image.localName !== 'svg' || document.querySelector('parsererror') || image.namespaceURI !== 'http://www.w3.org/2000/svg') throw new Error('Invalid Mermaid SVG.');
  const elements = [...image.querySelectorAll('*'), image];
  if (elements.length > 100000) throw new Error('Mermaid SVG is too complex.');
  for (const element of elements) {
    if (/^(?:script|iframe|object|embed|link|image|audio|video|animate|animateTransform|set)$/i.test(element.localName)) throw new Error('Active or externally sourced Mermaid SVG.');
    for (const attribute of element.attributes) {
      if (/^on/i.test(attribute.localName) || attribute.name === 'xml:base') throw new Error('Active Mermaid SVG attribute.');
      if (/^(?:href|src)$/i.test(attribute.localName) && !/^#[\w:.-]+$/.test(attribute.value)) throw new Error('Mermaid SVG references must be local fragments.');
    }
    const css = element.localName === 'style' ? element.textContent || '' : [...element.attributes].filter((attribute) => /^(?:style|fill|stroke|filter|mask|clip-path|cursor|marker-start|marker-mid|marker-end)$/i.test(attribute.localName)).map((attribute) => attribute.value).join(';');
    if (/@import|@font-face|expression\s*\(|behavior\s*:|-moz-binding|\\/i.test(css)) throw new Error('Unsafe Mermaid SVG styles.');
    for (const match of css.matchAll(/url\s*\(([^)]*)\)/gi)) if (!/^(['"]?)#[\w:.-]+\1$/.test(match[1].trim())) throw new Error('External Mermaid SVG resource.');
  }
  const viewBox = (image.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  const width = viewBox[2], height = viewBox[3];
  if (viewBox.length !== 4 || !viewBox.every(Number.isFinite) || width <= 0 || height <= 0 || width > 32768 || height > 32768 || width * height > 64000000) throw new Error('Invalid Mermaid diagram dimensions.');
  // Explicit pixel geometry keeps SVG labels legible when the viewer zooms.
  image.setAttribute('width', String(width)); image.setAttribute('height', String(height));
  const Serializer = root.defaultView!.XMLSerializer;
  const serialized = new TextEncoder().encode(new Serializer().serializeToString(image));
  let binary = '';
  for (let start = 0; start < serialized.length; start += 8192) binary += String.fromCharCode(...serialized.subarray(start, start + 8192));
  return { src: `data:image/svg+xml;base64,${btoa(binary)}`, width, height };
}

export function mermaidPanelColor(paper: string, ink: string): string {
  // Docsy's --panel is a deliberately dark code surface even in light mode;
  // diagram labels use --ink, so derive their surface from the page instead.
  return '#' + [1, 3, 5].map((start) => Math.round(Number.parseInt(paper.slice(start, start + 2), 16) * 0.94 + Number.parseInt(ink.slice(start, start + 2), 16) * 0.06).toString(16).padStart(2, '0')).join('');
}

function palette(root: Document) {
  const sample = root.createElement('span'); sample.hidden = true; root.body.append(sample);
  const color = (token: string, fallback: string) => {
    sample.style.color = `var(${token})`;
    const rgb = root.defaultView!.getComputedStyle(sample).color.match(/^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/);
    return rgb ? '#' + rgb.slice(1, 4).map((value) => Number(value).toString(16).padStart(2, '0')).join('') : fallback;
  };
  const ink = color('--ink', '#171717'), paper = color('--paper', '#ffffff'), line = color('--muted', '#737373');
  const panel = mermaidPanelColor(paper, ink);
  sample.remove();
  return { ink, paper, panel, line, fontFamily: root.defaultView!.getComputedStyle(root.body).fontFamily };
}

export function initMermaid(root: Document = document): () => void {
  controllers.get(root)?.();
  const cards = [...root.querySelectorAll<HTMLElement>('[data-docsy-mermaid]')];
  if (!cards.length) return () => {};
  let disposed = false, pending = false, repeat = false, initial = true, interacted = false;
  const interactionEvents = ['wheel', 'pointerdown', 'touchstart', 'keydown'];
  const interact = () => { interacted = true; };
  const stopTrackingInteraction = () => interactionEvents.forEach((name) => root.removeEventListener(name, interact, true));
  interactionEvents.forEach((name) => root.addEventListener(name, interact, { capture: true, passive: true }));
  let engine: Promise<(typeof import('mermaid'))['default']> | undefined;
  const render = async () => {
    if (pending) { repeat = true; return; }
    pending = true;
    try {
      // Fonts are already local; never add a CDN or renderer-specific font.
      await root.fonts?.ready;
      const mermaid = await (engine ??= import('mermaid').then((module) => module.default));
      do {
        repeat = false;
        const theme = root.documentElement.dataset.theme || 'light';
        const { ink, paper, panel, line, fontFamily } = palette(root);
        for (const card of cards) {
          if (disposed) return;
          if (card.dataset.renderedTheme === theme) continue;
          const preview = card.querySelector<HTMLElement>('[data-mermaid-preview]')!;
          const source = card.querySelector('code')?.textContent || '';
          const details = card.querySelector<HTMLDetailsElement>('details')!;
          const error = card.querySelector<HTMLElement>('[data-mermaid-error]')!;
          let container: HTMLElement | undefined;
          try {
            const maxTextSize = Math.min(100000, Math.max(100, Number(card.dataset.maxTextSize) || 50000));
            const maxEdges = Math.min(2000, Math.max(1, Number(card.dataset.maxEdges) || 500));
            validateMermaidSource(source, maxTextSize);
            const settings: MermaidConfig = {
              startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true,
              maxTextSize, maxEdges, htmlLabels: false, fontFamily,
              secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'maxEdges', 'suppressErrorRendering', 'htmlLabels', 'themeCSS', 'fontFamily'],
              theme: 'base', themeVariables: {
                darkMode: theme === 'dark', background: paper, fontFamily, fontSize: '14px',
                primaryColor: panel, primaryTextColor: ink, primaryBorderColor: line,
                secondaryColor: panel, tertiaryColor: paper, textColor: ink, lineColor: line,
                mainBkg: panel, nodeBorder: line, clusterBkg: paper, clusterBorder: line,
                edgeLabelBackground: paper, actorBkg: panel, actorTextColor: ink, actorBorder: line,
                actorLineColor: line, signalColor: ink, signalTextColor: ink,
                labelBoxBkgColor: panel, labelTextColor: ink, loopTextColor: ink,
                noteBkgColor: panel, noteTextColor: ink, noteBorderColor: line,
              },
            };
            mermaid.initialize(settings);
            // Mermaid needs a real layout box for measuring text, even in a
            // collapsed tab. The temporary tree is removed on success or error.
            container = root.createElement('div'); container.className = 'docsy-mermaid-measure'; root.body.append(container);
            const { svg } = await mermaid.render(`docsy-mermaid-${crypto.randomUUID()}`, source, container);
            if (disposed) return;
            if ((root.documentElement.dataset.theme || 'light') !== theme) { repeat = true; break; }
            const rendered = mermaidImage(svg, root);
            const image = root.createElement('img'); image.src = rendered.src;
            image.alt = card.querySelector('figcaption')?.textContent || 'Mermaid diagram';
            image.width = Math.ceil(rendered.width); image.height = Math.ceil(rendered.height);
            image.setAttribute('data-docsy-media', 'true'); image.setAttribute('data-docsy-embedded-image', 'true');
            image.setAttribute('data-media-background', theme === 'dark' ? 'dark' : 'light');
            preview.replaceChildren(image); preview.hidden = false; error.hidden = true;
            if (!card.dataset.renderedTheme) details.open = false;
            card.dataset.renderedTheme = theme;
          } catch {
            preview.replaceChildren(); preview.hidden = true; error.hidden = false; details.open = true;
            card.dataset.renderedTheme = theme;
          } finally { container?.remove(); }
        }
      } while (repeat && !disposed);
    } catch {
      // Offline/missing chunks leave a readable, copyable source and visible
      // failure message rather than hiding the diagram's only representation.
      for (const card of cards) card.querySelector<HTMLElement>('[data-mermaid-error]')!.hidden = false;
    } finally {
      pending = false;
      if (!disposed) {
        initMediaViewer(root);
        // Collapsing source fallbacks changes article height. Preserve an
        // initial deep link after layout settles, but never fight a reader who
        // has already scrolled, clicked or started using the keyboard.
        if (initial && !interacted) {
          try { const id = decodeURIComponent(root.defaultView!.location.hash.slice(1)); if (id) root.getElementById(id)?.scrollIntoView({ block: 'start' }); } catch { /* malformed hash */ }
        }
      }
      initial = false; stopTrackingInteraction();
    }
  };
  const Observer = root.defaultView!.MutationObserver;
  const observer = new Observer(() => { void render(); });
  observer.observe(root.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  void render();
  const cleanup = () => { disposed = true; observer.disconnect(); stopTrackingInteraction(); controllers.delete(root); };
  controllers.set(root, cleanup);
  return cleanup;
}
