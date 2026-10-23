import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { allContexts, docsPath, docsyConfig } from '../src/config';
import type { SidebarIconConfig } from '../src/lib/sidebar-icons';
import { articleUrl, getArticleSources, loadArticle } from '../src/lib/article-loader';
import { getSdkSources, loadSdk } from '../src/lib/sdk-loaders';
import { API_SECTIONS, loadSwagger, filterEndpoints } from '../src/lib/swagger-loader';
import { extractHtml } from '../src/lib/html-content';
import { getDocsNav, type DocsNavItem } from '../src/data/docs-nav';
import { loadDiagram } from '../src/lib/drawio';
import { notFoundHref } from '../src/lib/not-found';

const errors: string[] = [];
const pages = new Map<string, { ids: Set<string>; links: string[] }>();
const root = docsPath();
const clean = (path: string) => path.replace(/\/+$/, '') || '/';
const checkIcon = (icon: SidebarIconConfig | undefined, label: string) => {
  if (!icon || (typeof icon === 'object' && 'pack' in icon)) return;
  const sources = typeof icon === 'string' ? [icon] : [icon.src, icon.darkSrc].filter((src): src is string => Boolean(src));
  for (const source of sources) {
    if (/^https?:\/\//i.test(source) || /^(?:lucide|tabler):/.test(source)) continue;
    const file = resolve(process.cwd(), 'public', decodeURIComponent(source.split(/[?#]/)[0]).replace(/^\/+/, ''));
    if (!existsSync(file)) errors.push(`${label}: missing sidebar icon ${source}`);
  }
};
const checkItemIcons = (items: typeof docsyConfig.navigation[number]['items'], label: string) => items.forEach((item, index) => {
  const path = `${label}.${index}`;
  checkIcon(item.icon, `${path}.icon`);
  if (item.items) checkItemIcons(item.items, `${path}.items`);
});
docsyConfig.navigation.forEach((section, index) => {
  checkIcon(section.icon, `navigation.${index}.icon`);
  checkItemIcons(section.items, `navigation.${index}.items`);
});
for (const [id, diagram] of Object.entries(docsyConfig.content.diagrams)) if (docsyConfig.content.components.includes(diagram.format)) loadDiagram(id);
for (const context of allContexts) {
  pages.set(docsPath('/', context), { ids: new Set(), links: [] });
  for (const article of getArticleSources(context)) {
    const doc = await loadArticle(article);
    pages.set(articleUrl(article, context), extractHtml(doc.html));
  }
  const spec = await loadSwagger(context.version);
  for (const section of API_SECTIONS) {
    const endpoints = filterEndpoints(spec, section);
    pages.set(docsPath(`/api/${section.section}`, context), { ids: new Set(endpoints.map((endpoint) => endpoint.id)), links: [] });
  }
  for (const sdk of getSdkSources()) {
    const source = { ...sdk, source: sdk.versions[context.version] ?? sdk.source };
    const doc = loadSdk(source);
    pages.set(docsPath(`/${sdk.slug}`, context), { ids: new Set(doc.categories.flatMap((category) => [category.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), ...category.items.map((item) => item.id)])), links: [] });
  }
}
pages.set(docsPath('/locked'), { ids: new Set(), links: [] });
pages.set(docsPath('/404.html'), { ids: new Set(['not-found-title']), links: [] });
for (const [from, to] of Object.entries(docsyConfig.redirects)) {
  const path = docsPath(from);
  if (pages.has(path)) errors.push(`redirects: ${from} collides with a generated page`);
  else pages.set(path, { ids: new Set(), links: [docsPath(to)] });
}
const checkLink = (href: string, from: string) => {
  if (!href || href === '#' || /^(?:mailto:|tel:|data:)/i.test(href)) return;
  let url: URL;
  try { url = new URL(href, `${docsyConfig.site.origin}${from}/`); } catch { errors.push(`${from}: invalid URL ${href}`); return; }
  if (url.origin !== new URL(docsyConfig.site.origin).origin) return;
  const path = clean(decodeURIComponent(url.pathname));
  if (root !== '/' && path !== root && !path.startsWith(`${root}/`)) return;
  const relative = root === '/' ? path : path.slice(root.length);
  if (relative.startsWith('/assets/')) {
    if (!existsSync(resolve(process.cwd(), `public${relative}`))) errors.push(`${from}: missing asset ${href}`);
    return;
  }
  const target = pages.get(path);
  if (!target) { errors.push(`${from}: broken link ${href}`); return; }
  if (url.hash && !target.ids.has(decodeURIComponent(url.hash.slice(1)))) errors.push(`${from}: broken anchor ${href}`);
};
if (docsyConfig.validation.links) {
  for (const context of allContexts) {
    for (const action of [docsyConfig.notFound.primaryAction, docsyConfig.notFound.secondaryAction, ...docsyConfig.notFound.links]) {
      if (action) checkLink(notFoundHref(action.href, context), docsPath('/404.html'));
    }
  }
  for (const [path, page] of pages) for (const href of page.links) checkLink(href, path);
  const registered = new Set(docsyConfig.content.articles.map((article) => article.slug));
  const checkRegistered = (items: typeof docsyConfig.navigation[number]['items']) => items.forEach((item) => { const path = item.href.split(/[?#]/)[0]; if (path.startsWith('/guides/') && !registered.has(path.slice(8))) errors.push(`navigation: unknown article ${item.href}`); if (item.items) checkRegistered(item.items); });
  for (const section of docsyConfig.navigation) checkRegistered(section.items);
  for (const context of allContexts) {
    const checkNav = (items: DocsNavItem[]) => items.forEach((item) => { checkLink(item.href, docsPath('/', context)); if (item.items) checkNav(item.items); });
    for (const section of getDocsNav(context)) checkNav(section.items);
  }
}
if (errors.length) throw new Error(`Docsy content validation failed:\n${[...new Set(errors)].map((error) => `- ${error}`).join('\n')}`);
console.log(`Validated ${pages.size} documentation routes across ${allContexts.length} version/locale contexts; OpenAPI references/examples${docsyConfig.validation.links ? ' and internal links/anchors' : ''} checked.`);
