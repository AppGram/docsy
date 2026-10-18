import { readFileSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import remarkDirective from 'remark-directive';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { docsyConfig } from '../config';

type Node = { type: string; name?: string; value?: string; children?: Node[]; attributes?: Record<string, string>; data?: Record<string, any>; [key: string]: any };
const text = (value: string): Node => ({ type: 'text', value });
const paragraph = (value: string, tag = 'p'): Node => ({ type: 'paragraph', children: [text(value)], data: { hName: tag, hProperties: { className: ['docsy-component-title'] } } });
const label = (node: Node) => node.children?.find((child) => child.data?.directiveLabel)?.children?.map((child) => child.value ?? '').join('') || node.attributes?.title || '';
const body = (node: Node) => node.children?.filter((child) => !child.data?.directiveLabel) ?? [];

export function expandSnippets(markdown: string, stack: string[] = []): string {
  // Parse includes, so a directive inside a fenced code example is never expanded.
  const tree = unified().use(remarkParse).use(remarkDirective).parse(markdown) as unknown as Node;
  const replacements: { start: number; end: number; value: string }[] = [];
  const visit = (node: Node) => {
    if (node.type === 'leafDirective' && node.name === 'include') {
      if (!docsyConfig.content.components.includes('include')) throw new Error('The include component is disabled in YAML.');
      const key = node.attributes?.src;
      if (!key || !Object.hasOwn(docsyConfig.content.snippets, key)) throw new Error(`Unknown snippet: ${key ?? '(missing src)'}`);
      if (stack.includes(key) || stack.length >= 10) throw new Error(`Circular/deep snippet include: ${[...stack, key].join(' → ')}`);
      const project = realpathSync(process.cwd());
      const path = realpathSync(resolve(project, docsyConfig.content.snippets[key]));
      const rel = relative(project, path);
      if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Snippet ${key} must stay inside the project.`);
      replacements.push({ start: node.position.start.offset, end: node.position.end.offset, value: expandSnippets(readFileSync(path, 'utf8'), [...stack, key]) });
    } else node.children?.forEach(visit);
  };
  visit(tree);
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) markdown = markdown.slice(0, replacement.start) + replacement.value + markdown.slice(replacement.end);
  return markdown;
}

export const richComponents = () => (tree: Node) => {
  const visit = (node: Node, parent?: Node) => {
    if (node.type.endsWith('Directive')) {
      const name = node.name!;
      const known = ['note', 'tip', 'warning', 'danger', 'steps', 'tabs', 'tab', 'accordion', 'code-group'];
      if (!known.includes(name)) throw new Error(`Unknown article component: ${name}`);
      if (name !== 'tab' && !docsyConfig.content.components.includes(name as any)) throw new Error(`Article component ${name} is disabled in YAML.`);
      const title = label(node);
      const children = body(node);
      node.data = { hName: 'div', hProperties: { className: [`docsy-${name}`] } };
      if (['note', 'tip', 'warning', 'danger'].includes(name)) {
        node.data.hName = 'aside';
        node.data.hProperties.className = ['docsy-callout'];
        node.data.hProperties['data-kind'] = name;
        node.children = [paragraph(title || name[0].toUpperCase() + name.slice(1)), ...children];
      } else if (name === 'accordion') {
        node.data.hName = 'details';
        node.children = [paragraph(title || 'Details', 'summary'), ...children];
      } else if (name === 'tabs') {
        if (!children.length || children.some((child) => child.name !== 'tab')) throw new Error('tabs may contain only tab directives.');
        node.data.hProperties['data-sync'] = node.attributes?.sync ?? '';
        node.children = children;
      } else if (name === 'steps') {
        if (children.length !== 1 || children[0].type !== 'list' || !children[0].ordered) throw new Error('steps must contain one Markdown ordered list.');
        children[0].data = { hProperties: { role: 'list' } };
        node.children = children;
      } else if (name === 'tab') {
        if (parent?.name !== 'tabs') throw new Error('tab must be nested inside tabs.');
        node.data.hProperties['data-label'] = title || 'Tab';
        node.children = [paragraph(title || 'Tab'), ...children];
      } else if (name === 'code-group') {
        if (!children.length || children.some((child) => child.type !== 'code')) throw new Error('code-group may contain only fenced code blocks.');
        node.name = 'tabs';
        node.data.hProperties.className = ['docsy-tabs'];
        node.data.hProperties['data-sync'] = node.attributes?.sync ?? '';
        node.children = children.map((child) => ({ type: 'containerDirective', name: 'tab', attributes: { title: child.meta || child.lang || 'Code' }, children: [child] }));
      } else node.children = children;
    }
    node.children?.forEach((child) => visit(child, node));
  };
  visit(tree);
};

export const richPlugins = [remarkDirective, richComponents];

export function plainMarkdown(markdown: string): string {
  const transform = () => (tree: Node) => {
    const visit = (node: Node) => {
      node.children?.forEach(visit);
      if (!node.type.endsWith('Directive')) return;
      const title = label(node);
      node.type = 'blockquote';
      node.children = [...(title ? [paragraph(title)] : []), ...body(node)];
      delete node.name; delete node.attributes; delete node.data;
    };
    visit(tree);
  };
  return String(unified().use(remarkParse).use(remarkDirective).use(transform as any).use(remarkStringify).processSync(markdown));
}
