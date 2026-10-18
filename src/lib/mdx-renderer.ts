import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compile, run } from '@mdx-js/mdx';
import * as runtime from 'react/jsx-runtime';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import remarkGfm from 'remark-gfm';
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import rehypeRemark from 'rehype-remark';
import remarkStringify from 'remark-stringify';
import { build } from 'esbuild';
import { docsyConfig, resolveSource } from '../config';
import { splitMdxFrontmatter, validateMdx } from '../../scripts/lib/mdx-policy.mjs';
import { builtInMdxComponents, mdxHref } from './mdx-components';
import { highlightArticles } from './code-renderer';
import type { MarkdownHeading } from '@astrojs/markdown-remark';
import type { Root as HastRoot } from 'hast';
import type { Root as MdastRoot } from 'mdast';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const layoutChildren = () => (tree: any) => {
  const visit = (node: any) => {
    if (['Steps', 'Tabs', 'CardGroup', 'AccordionGroup'].includes(node.name)) {
      node.children = node.children.flatMap((child: any) => child.type === 'paragraph' && child.children.every((item: any) => item.type.startsWith('mdxJsx') || (item.type === 'text' && !item.value.trim())) ? child.children : [child]);
    }
    node.children?.forEach(visit);
  };
  visit(tree);
};
const options = { remarkPlugins: [remarkGfm, layoutChildren], development: false };
const codeTitles = () => (tree: any) => {
  const visit = (node: any) => {
    if (node.tagName === 'code' && node.data?.meta) node.properties['data-title'] = node.data.meta.replace(/^['"]|['"]$/g, '');
    node.children?.forEach(visit);
  };
  visit(tree);
};
const compiled = new Map<string, Promise<any>>();
const trusted = new Map<string, { inputs: Record<string, number>; promise: Promise<any> }>();

async function trustedModule(body: string, file: string) {
  const key = hash(body + file + JSON.stringify(docsyConfig.content.mdx.components));
  const cached = trusted.get(key);
  if (cached && Object.entries(cached.inputs).every(([path, mtime]) => { try { return statSync(path).mtimeMs === mtime; } catch { return false; } })) return cached.promise;
  const entry = { inputs: {} as Record<string, number>, promise: Promise.resolve(null) as Promise<any> };
  entry.promise = (async () => {
    const trustedOptions = { ...options, rehypePlugins: [codeTitles], providerImportSource: 'docsy:mdx-provider' };
    const mdx = String(await compile(body, trustedOptions));
    const imports = Object.values(docsyConfig.content.mdx.components).map((path, index) => `import Custom${index} from ${JSON.stringify(resolveSource(path))};`).join('\n');
    const map = Object.keys(docsyConfig.content.mdx.components).map((name, index) => `${JSON.stringify(name)}: Custom${index}`).join(',');
    const result = await build({
      stdin: { contents: `${imports}\n${mdx}\nexport const docsyComponents = {${map}};\nexport { setDocsyComponents } from 'docsy:mdx-provider';`, resolveDir: dirname(file), sourcefile: file, loader: 'jsx' },
      bundle: true, write: false, format: 'esm', platform: 'node', packages: 'external', metafile: true,
      jsx: 'automatic', logLevel: 'silent',
      plugins: [{ name: 'docsy-mdx', setup(builder) {
        builder.onResolve({ filter: /^docsy:mdx-provider$/ }, () => ({ path: 'provider', namespace: 'docsy-mdx' }));
        builder.onLoad({ filter: /.*/, namespace: 'docsy-mdx' }, () => ({ contents: 'let components = {}; export const useMDXComponents = () => components; export const setDocsyComponents = (value) => { components = value; };', loader: 'js' }));
        builder.onLoad({ filter: /\.mdx$/i }, async ({ path }) => {
          const { body } = splitMdxFrontmatter(readFileSync(path, 'utf8'), path);
          return { contents: String(await compile(body, trustedOptions)), loader: 'jsx', resolveDir: dirname(path) };
        });
      } }],
    });
    for (const path of Object.keys(result.metafile!.inputs)) {
      const absolute = resolve(path);
      try { entry.inputs[absolute] = statSync(absolute).mtimeMs; } catch { /* stdin has no physical dependency */ }
    }
    const output = result.outputFiles![0].text;
    const directory = resolve(process.cwd(), '.docsy/cache/mdx');
    mkdirSync(directory, { recursive: true });
    const path = resolve(directory, `${hash(output)}.mjs`);
    writeFileSync(path, output);
    return import(/* @vite-ignore */ pathToFileURL(path).href);
  })();
  if (trusted.size >= 200) trusted.delete(trusted.keys().next().value!);
  trusted.set(key, entry);
  return entry.promise;
}

export async function renderMdx(source: string, file: string) {
  const settings = docsyConfig.content.mdx;
  if (!settings.enabled) throw new Error('MDX articles are disabled by content.mdx.enabled.');
  if (extname(file).toLowerCase() !== '.mdx') throw new Error('MDX articles must use the .mdx extension.');
  const { body } = splitMdxFrontmatter(source, file);
  validateMdx(body, { label: file, allowJavaScript: settings.allowJavaScript, components: docsyConfig.content.components });
  let module: any;
  if (settings.allowJavaScript) module = await trustedModule(body, file);
  else {
    const key = hash(body);
    let promise = compiled.get(key);
    if (!promise) {
      promise = compile(body, { ...options, outputFormat: 'function-body', rehypePlugins: [codeTitles] }).then((code) => run(String(code), { ...runtime, baseUrl: pathToFileURL(file) }));
      if (compiled.size >= 200) compiled.delete(compiled.keys().next().value!);
      compiled.set(key, promise);
    }
    module = await promise;
  }
  const components = { ...builtInMdxComponents, ...module.docsyComponents };
  module.setDocsyComponents?.(components);
  const raw = renderToStaticMarkup(createElement(module.default, { components }));
  const headings: MarkdownHeading[] = [];
  const collectHeadings = () => (tree: any) => {
    const text = (node: any): string => node.type === 'text' ? node.value : (node.children || []).map(text).join('');
    const visit = (node: any) => {
      if (node.properties) for (const key of ['href', 'src']) if (typeof node.properties[key] === 'string') node.properties[key] = mdxHref(node.properties[key]);
      if (/^h[1-6]$/.test(node.tagName)) headings.push({ depth: Number(node.tagName[1]), slug: String(node.properties.id), text: text(node) });
      node.children?.forEach(visit);
    };
    visit(tree);
  };
  const tree = await unified().use(rehypeParse, { fragment: true }).use(rehypeSlug).use(collectHeadings).run(unified().use(rehypeParse, { fragment: true }).parse(raw)) as HastRoot;
  // Export before syntax decoration: agents get real code, not UI labels/copy buttons.
  const mdast = await unified().use(rehypeRemark).run(tree);
  const markdown = unified().use(remarkGfm).use(remarkStringify, { fences: true }).stringify(mdast as MdastRoot);
  const highlighted = await unified().use(highlightArticles).run(tree);
  const html = unified().use(rehypeStringify).stringify(highlighted as HastRoot);
  return { html, headings, markdown };
}
