import { Children, createElement as h, isValidElement, type ReactNode, type ReactElement } from 'react';
import { docsPath, docsyConfig } from '../config';
import { Drawio } from './drawio';

type Props = { children?: ReactNode; title?: string; label?: string; name?: string; sync?: string; group?: string; href?: string; cols?: number; defaultOpen?: boolean; [key: string]: any };
const title = (value: ReactNode) => h('p', { className: 'docsy-component-title' }, value);
const paths: Record<string, string[]> = {
  note: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 11v6', 'M12 7h.01'],
  tip: ['M9 18h6', 'M10 21h4', 'M8.6 14.5a6 6 0 1 1 6.8 0c-.9.6-1.4 1.5-1.4 2.5h-4c0-1-.5-1.9-1.4-2.5Z'],
  warning: ['m10.3 4.1-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-2.9l-8-14a2 2 0 0 0-3.4 0Z', 'M12 9v4', 'M12 17h.01'],
  danger: ['m8 2-6 6v8l6 6h8l6-6V8l-6-6H8Z', 'M12 7v6', 'M12 17h.01'],
};
const callout = (kind: string) => ({ children, title: label }: Props) => h('aside', { className: 'docsy-callout', 'data-kind': kind },
  h('span', { className: 'docsy-callout-icon', 'aria-hidden': true }, h('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }, paths[kind].map((d) => h('path', { key: d, d })))),
  h('div', { className: 'docsy-callout-content' }, title(label || kind[0].toUpperCase() + kind.slice(1)), children));
const elements = (children: ReactNode) => Children.toArray(children).filter(isValidElement) as ReactElement<Props>[];
const Tabs = ({ children, sync, group }: Props) => h('div', { className: 'docsy-tabs', 'data-sync': sync || group || '' }, children);
const Tab = ({ children, title: label = 'Tab' }: Props) => h('div', { className: 'docsy-tab', 'data-label': label }, title(label), children);
const codeLabel = (node: ReactElement<Props>, index: number): string => {
  const code = elements(node.props.children)[0];
  return code?.props['data-title'] || String(code?.props.className || '').replace('language-', '') || `Example ${index + 1}`;
};
// Root-relative links/assets follow site.basePath; relative and external links stay intact.
export const mdxHref = (href?: string) => {
  const base = docsyConfig.site.basePath.replace(/\/$/, '');
  return href?.startsWith('/') && !href.startsWith('//') && !(base && (href === base || href.startsWith(`${base}/`))) ? docsPath(href) : href;
};
export const builtInMdxComponents = {
  Drawio,
  Note: callout('note'), Info: callout('note'), Tip: callout('tip'), Check: callout('tip'), Warning: callout('warning'), Danger: callout('danger'),
  Tabs, Tab,
  Steps: ({ children }: Props) => h('div', { className: 'docsy-steps' }, h('ol', { role: 'list' }, children)),
  Step: ({ children, title: label }: Props) => h('li', null, label ? title(label) : null, children),
  Accordion: ({ children, title: label = 'Details', defaultOpen }: Props) => h('details', { className: 'docsy-accordion', open: defaultOpen }, h('summary', { className: 'docsy-component-title' }, label), children),
  AccordionGroup: ({ children }: Props) => h('div', { className: 'docsy-accordion-group' }, children),
  CodeGroup: ({ children, sync, group }: Props) => h(Tabs, { sync, group }, elements(children).map((child, index) => h(Tab, { key: index, title: codeLabel(child, index) }, child))),
  CardGroup: ({ children, cols = 2 }: Props) => h('div', { className: 'docsy-card-group', 'data-cols': Math.max(1, Math.min(3, Number(cols) || 2)) }, children),
  Card: ({ children, title: label, href }: Props) => h('section', { className: 'docsy-mdx-card' }, h('p', { className: 'docsy-component-title' }, href ? h('a', { href: mdxHref(href) }, label, h('span', { 'aria-hidden': true }, ' →')) : label), children),
  Frame: ({ children }: Props) => h('figure', { className: 'docsy-frame' }, children),
  a: ({ href, children, ...props }: Props) => h('a', { ...props, href: mdxHref(href) }, children),
  img: ({ src, ...props }: Props) => h('img', { ...props, src: mdxHref(src) }),
};
