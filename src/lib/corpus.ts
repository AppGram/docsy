import { allContexts, docsPath, docsyConfig } from '../config';
import { articleRoute, articleUrl, getArticleSources, loadArticle } from './article-loader';
import { getSdkSources, loadSdk } from './sdk-loaders';
import { API_SECTIONS, filterEndpoints, loadSwagger } from './swagger-loader';
import { htmlSections } from './html-content';
import { documentKey } from './documents';
import type { SearchRecord } from './search';

let promise: Promise<SearchRecord[]> | undefined;
export function buildCorpus(): Promise<SearchRecord[]> {
  // Dev creates a fresh index after edits; production processes cache immutable sources.
  if (import.meta.env?.DEV) return collect();
  return promise ??= collect();
}
async function collect(): Promise<SearchRecord[]> {
  const records: SearchRecord[] = [];
  for (const context of allContexts) {
    const links = (route: string) => { const key = documentKey(docsPath(route, context)); return { markdownUrl: docsPath(`/format-md/${key}`), jsonUrl: docsPath(`/agent/pages/${key}.json`) }; };
    for (const source of getArticleSources(context)) {
      const article = await loadArticle(source);
      const url = articleUrl(source, context);
      const sections = htmlSections(article.html);
      sections.forEach((section, index) => records.push({
        id: `${context.version}:${context.locale}:article:${source.slug}:${index}`,
        type: 'page', kind: index === 0 ? 'article' : 'section',
        title: section.title || source.title, group: source.title,
        summary: source.description, body: `${index === 0 ? `${source.title} ${source.description} ` : ''}${section.text}`,
        contentLocale: source.locale ?? docsyConfig.localization?.defaultLocale ?? docsyConfig.site.language,
        isFallback: (source.locale ?? docsyConfig.localization?.defaultLocale ?? docsyConfig.site.language) !== context.locale,
        url: `${url}${section.id ? `#${encodeURIComponent(section.id)}` : ''}`, ...context, ...links(articleRoute(source)),
      }));
    }
    const spec = await loadSwagger(context.version);
    for (const section of API_SECTIONS) for (const endpoint of filterEndpoints(spec, section)) records.push({
      id: `${context.version}:${context.locale}:api:${endpoint.id}`, type: 'api', title: endpoint.summary || endpoint.path,
      url: `${docsPath(`/api/${section.section}`, context)}#${endpoint.id}`, group: section.title,
      body: [endpoint.description ?? '', endpoint.path, ...[...endpoint.pathParams, ...endpoint.queryParams, ...endpoint.headerParams, ...endpoint.bodyProperties].map((p) => `${p.name} ${p.description ?? ''}`), endpoint.curl, endpoint.responseExample ?? ''].join(' '),
      method: endpoint.method.toUpperCase(), path: endpoint.path, ...context, ...links(`/api/${section.section}`),
    });
    for (const source of getSdkSources()) {
      const sdk = loadSdk({ ...source, source: source.versions[context.version] ?? source.source });
      for (const category of sdk.categories) for (const item of category.items) records.push({
        id: `${context.version}:${context.locale}:sdk:${source.id}:${item.id}`, type: 'sdk', kind: item.kind,
        title: item.name, group: `${sdk.name} · ${category.title}`, url: `${docsPath(`/${source.slug}`, context)}#${item.id}`,
        body: [item.summary, item.declaration, item.example, item.returnsDoc, ...item.parameters?.map((p) => `${p.name} ${p.type} ${p.description ?? ''}`) ?? []].filter(Boolean).join(' '),
        ...context, ...links(`/${source.slug}`),
      });
    }
    const home = { ...docsyConfig.home, ...docsyConfig.home.translations[context.locale] };
    records.push({ id: `${context.version}:${context.locale}:home`, type: 'page', title: home.title, group: docsyConfig.site.name, url: docsPath('/', context), body: home.description, ...context, ...links('/') });
  }
  return records;
}
