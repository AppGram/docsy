import { randomUUID } from 'node:crypto';
import { codeToTokensWithThemes } from 'shiki';
import type { BundledTheme } from 'shiki';
import { toHtml } from 'hast-util-to-html';
import type { Element, ElementContent, Root, Text } from 'hast';
import { codeLanguage } from './code-languages';
import { docsyConfig } from '../config';

const text = (value: string): Text => ({ type: 'text', value });
const el = (tagName: string, properties: Element['properties'] = {}, children: ElementContent[] = []): Element => ({ type: 'element', tagName, properties, children });
const cache = new Map<string, Promise<ElementContent[]>>();
const themes = { light: docsyConfig.theme.code.lightTheme as BundledTheme, dark: docsyConfig.theme.code.darkTheme as BundledTheme };

async function highlight(code: string, grammar: string): Promise<ElementContent[]> {
  if (grammar === 'text' || code.length > 100_000) return [text(code)];
  const key = `${grammar}\0${code}`;
  if (cache.has(key)) return cache.get(key)!;
  const pending = (async () => {
    const lines = await codeToTokensWithThemes(code, { lang: grammar as any, themes });
    const breaks = code.match(/\r\n|\n|\r/g) || [];
    const children: ElementContent[] = [];
    lines.forEach((tokens, line) => {
      if (line) children.push(text(breaks[line - 1] || '\n'));
      for (const token of tokens) children.push(el('span', {
        className: ['cb-token'],
        style: `--syntax-light:${token.variants.light.color};--syntax-dark:${token.variants.dark.color}`,
      }, [text(token.content)]));
    });
    return children;
  })();
  cache.set(key, pending);
  if (cache.size > 256) cache.delete(cache.keys().next().value!);
  try { return await pending; } catch (error) { cache.delete(key); throw error; }
}

const path = (d: string, properties: Element['properties'] = {}) => el('path', { d, ...properties });
const svg = (paths: ElementContent[], properties: Element['properties'] = {}) => el('svg', { viewBox: '0 0 16 16', width: 14, height: 14, ariaHidden: 'true', ...properties }, paths);

export async function codeCard(code: string, language = 'text', title = 'Code'): Promise<Element> {
  const info = codeLanguage(language);
  const id = `code-${randomUUID()}`;
  const icon = info.icon ? [
    el('img', { className: ['cb-logo-light'], src: info.icon, alt: '', width: 20, height: 20 }),
    ...(info.iconDark ? [el('img', { className: ['cb-logo-dark'], src: info.iconDark, alt: '', width: 20, height: 20 })] : []),
  ] : [svg([path(info.grammar === 'shellscript' ? 'm3 4 4 4-4 4m6 0h4' : 'm5 4-4 4 4 4m6-8 4 4-4 4M9 2 7 14', { fill: 'none', stroke: 'currentColor', strokeWidth: '1.4', strokeLinecap: 'round', strokeLinejoin: 'round' })], { width: 20, height: 20 })];
  const children = await highlight(code, info.grammar);
  return el('div', { className: ['cb'], dataCodeLanguage: info.key }, [
    el('div', { className: ['cb-head'] }, [
      el('span', { className: ['cb-title'] }, [text(title || 'Code')]),
      el('span', { className: ['cb-language', ...(info.iconDark ? ['has-dark'] : [])], role: 'img', ariaLabel: info.label, title: info.label }, icon),
    ]),
    el('div', { className: ['cb-body'] }, [
      el('pre', { className: ['cb-pre'], tabIndex: 0, ariaLabel: `${info.label} code` }, [el('code', { id, className: ['cb-code', `language-${info.grammar}`], dataHighlighted: info.grammar === 'text' || code.length > 100_000 ? 'plain' : 'shiki' }, children)]),
      el('button', { type: 'button', className: ['cb-copy'], dataCopyTarget: id, ariaLabel: 'Copy code' }, [
        el('span', { className: ['cb-copy-default'], ariaHidden: 'true' }, [svg([path('M4 4h7v7H4z M6 2h7v7', { fill: 'none', stroke: 'currentColor', strokeWidth: '1.4', strokeLinejoin: 'round' })])]),
        el('span', { className: ['cb-copy-done'], ariaHidden: 'true' }, [svg([path('M4 8.5l2.5 2.5L12 5.5', { fill: 'none', stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round', strokeLinejoin: 'round' })])]),
      ]),
    ]),
  ]);
}

export const renderCodeCard = async (code: string, language?: string, title?: string) => toHtml(await codeCard(code, language, title));

// The article pipeline and Astro components use the exact same safe HAST output.
// Never emit raw source as HTML, including for unknown/plain-text languages.
export const highlightArticles = () => async (tree: Root) => {
  const value = (node: any): string => node.type === 'text' ? node.value : (node.children || []).map(value).join('');
  const visit = async (parent: Root | Element) => {
    await Promise.all(parent.children.map(async (node, index) => {
      if (node.type !== 'element') return;
      const code = node.tagName === 'pre' && node.children.find((child): child is Element => child.type === 'element' && child.tagName === 'code');
      if (code) {
        const classes = code.properties.className;
        const language = (Array.isArray(classes) ? classes : String(classes || '').split(' ')).find((name) => String(name).startsWith('language-'));
        parent.children[index] = await codeCard(value(code), language ? String(language).slice(9) : 'text', String((code.data as { meta?: string } | undefined)?.meta || 'Code example'));
      } else await visit(node);
    }));
  };
  await visit(tree);
};
