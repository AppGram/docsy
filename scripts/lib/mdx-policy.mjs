import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkGfm from 'remark-gfm';
import { load } from 'js-yaml';

// Shared by the renderer and importer. Validation never evaluates source code.
export const mdxParser = unified().use(remarkParse).use(remarkGfm).use(remarkMdx);
export const mdxComponents = {
  Note: 'note', Info: 'note', Tip: 'tip', Check: 'tip', Warning: 'warning', Danger: 'danger',
  Tabs: 'tabs', Tab: 'tabs', Steps: 'steps', Step: 'steps',
  Accordion: 'accordion', AccordionGroup: 'accordion', CodeGroup: 'code-group',
  Card: 'card', CardGroup: 'card', Frame: 'frame', Drawio: 'drawio',
};
const htmlTags = new Set('a p div span strong em b i u s del br hr ul ol li blockquote pre code h1 h2 h3 h4 h5 h6 table thead tbody tr th td img figure figcaption details summary kbd sub sup video source track'.split(' '));
const attributes = new Set('title href src alt width height id className target rel open start colSpan rowSpan align loading decoding role aria-label aria-hidden controls poster preload playsInline muted loop type srcLang kind label default data-docsy-media'.split(' '));
const componentAttributes = new Set('title label name sync group cols href src icon horizontal defaultOpen children'.split(' '));
const fail = (label, node, reason) => { throw new Error(`${label}:${node.position?.start?.line ?? 1}: ${reason}`); };
const staticValue = (node) => {
  if (node.type === 'Literal') return node.regex ? false : ['string', 'number', 'boolean'].includes(typeof node.value) || node.value === null;
  if (node.type === 'UnaryExpression') return ['-', '+'].includes(node.operator) && node.argument.type === 'Literal' && typeof node.argument.value === 'number';
  if (node.type === 'ArrayExpression') return node.elements.every((item) => item && staticValue(item));
  if (node.type === 'ObjectExpression') return node.properties.every((property) => property.type === 'Property' && property.kind === 'init' && !property.method && !property.computed && !property.shorthand && !['__proto__', 'constructor', 'prototype'].includes(String(property.key.name ?? property.key.value)) && staticValue(property.value));
  return false;
};
const literalExpression = (node) => {
  const statements = node.data?.estree?.body;
  return statements?.length === 1 && statements[0].type === 'ExpressionStatement' && staticValue(statements[0].expression);
};
export const safeMdxUrl = (url) => !/^[\s\u0000-\u0020]*(?:javascript|vbscript|data):/i.test(String(url).replace(/[\u0000-\u0020]/g, ''));

export function splitMdxFrontmatter(source, label = 'MDX') {
  let body = source.replace(/^\uFEFF/, '');
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const frontmatter = match ? load(match[1]) || {} : {};
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) throw new Error(`${label}: invalid frontmatter.`);
  for (const key of ['title', 'description']) if (frontmatter[key] !== undefined && typeof frontmatter[key] !== 'string') throw new Error(`${label}: ${key} must be text.`);
  if (frontmatter.redirects !== undefined && (!Array.isArray(frontmatter.redirects) || frontmatter.redirects.some((item) => typeof item !== 'string'))) throw new Error(`${label}: redirects must be an array of paths.`);
  if (match) body = body.slice(match[0].length);
  return { frontmatter, body };
}

export function validateMdx(source, { label = 'MDX', allowJavaScript = false, components = Object.values(mdxComponents) } = {}) {
  const tree = mdxParser.parse(source);
  const visit = (node, parent) => {
    if (node.name && Object.hasOwn(mdxComponents, node.name) && !components.includes(mdxComponents[node.name])) fail(label, node, `Article component ${mdxComponents[node.name]} is disabled in YAML.`);
    if (node.name === 'Drawio') {
      if (!node.attributes?.some((attribute) => attribute.name === 'src' && typeof attribute.value === 'string' && attribute.value.trim())) fail(label, node, 'Drawio requires a quoted src matching content.diagrams.');
      if (node.children?.some((child) => child.type !== 'text' || child.value.trim())) fail(label, node, 'Drawio is a standalone diagram and cannot contain article content.');
    }
    if (!allowJavaScript) {
      if (node.type === 'mdxjsEsm') fail(label, node, 'Unsupported MDX import/export in declarative mode. Review the source, then explicitly enable content.mdx.allowJavaScript only for trusted code.');
      if (['mdxFlowExpression', 'mdxTextExpression', 'mdxJsxAttributeValueExpression'].includes(node.type) && !literalExpression(node)) {
        // MDX comments are safe and render no output.
        if (node.value?.trim() && node.data?.estree?.body?.length !== 0) fail(label, node, 'MDX JavaScript expressions require content.mdx.allowJavaScript: true. Literal values are supported without it.');
      }
      if (node.type.startsWith('mdxJsx') && node.name) {
        if (!Object.hasOwn(mdxComponents, node.name) && !htmlTags.has(node.name)) fail(label, node, `Unknown MDX component <${node.name}>. Register a trusted custom component in content.mdx.components, or use a built-in component.`);
        if (node.name === 'Tab' && parent?.name !== 'Tabs') fail(label, node, 'Tab must be nested inside Tabs.');
        if (node.name === 'Step' && parent?.name !== 'Steps') fail(label, node, 'Step must be nested inside Steps.');
        const expected = { Tabs: 'Tab', Steps: 'Step', CardGroup: 'Card', AccordionGroup: 'Accordion', CodeGroup: 'code' }[node.name];
        if (expected) {
          const children = (node.children || []).flatMap((child) => child.type === 'paragraph' ? child.children : [child]).filter((child) => !(child.type === 'text' && !child.value.trim()) && !(child.type === 'mdxFlowExpression' && child.data?.estree?.body?.length === 0));
          if (!children.length || children.some((child) => expected === 'code' ? child.type !== 'code' : child.name !== expected)) fail(label, node, `${node.name} must contain only ${expected === 'code' ? 'fenced code blocks' : `<${expected}> components`}.`);
        }
        for (const attribute of node.attributes || []) {
          if (attribute.type !== 'mdxJsxAttribute') fail(label, node, 'MDX spread attributes require trusted JavaScript mode.');
          const allowed = Object.hasOwn(mdxComponents, node.name) ? componentAttributes.has(attribute.name) : attributes.has(attribute.name);
          if (!allowed || /^on/i.test(attribute.name) || attribute.name === 'dangerouslySetInnerHTML') fail(label, node, `Unsupported attribute ${attribute.name} on <${node.name}> in declarative mode.`);
          if (typeof attribute.value === 'object' && attribute.value) {
            if (!literalExpression(attribute.value)) fail(label, node, `Attribute ${attribute.name} requires a literal value or trusted JavaScript mode.`);
            // URLs must remain plain strings so they can also be audited/rebased by migration.
            if (['href', 'src', 'poster'].includes(attribute.name)) fail(label, node, `${attribute.name} must be a quoted string in declarative mode.`);
          }
          if (['href', 'src', 'poster'].includes(attribute.name) && !safeMdxUrl(attribute.value)) fail(label, node, `Unsafe ${attribute.name} URL.`);
        }
      }
      if (['link', 'image', 'definition'].includes(node.type) && !safeMdxUrl(node.url)) fail(label, node, 'Unsafe Markdown URL.');
    }
    for (const child of node.children || []) visit(child, node.type.startsWith('mdxJsx') ? node : parent);
  };
  visit(tree);
  return tree;
}
