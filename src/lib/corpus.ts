import { allContexts, docsPath, docsyConfig } from '../config';
import { articleRoute, articleUrl, getArticleSources, loadArticle } from './article-loader';
import { getSdkSources, loadSdk } from './sdk-loaders';
import { API_SECTIONS, filterEndpoints, loadSwagger } from './swagger-loader';
import { htmlSections } from './html-content';
import { documentKey } from './documents';
import type { SearchRecord } from './search';
import { articleAuthorship } from './authorship';

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
      const authorship = articleAuthorship(source);
      const creditNames = [...authorship.authors, ...authorship.contributors, ...authorship.reviewedBy, ...(authorship.provenance ? [authorship.provenance.agent] : [])].map((author) => author.name).join(' ');
      sections.forEach((section, index) => records.push({
        id: `${context.version}:${context.locale}:article:${source.slug}:${index}`,
        type: 'page', kind: index === 0 ? 'article' : 'section',
        title: section.title || source.title, group: source.title,
        summary: source.description, authorship, body: `${index === 0 ? `${source.title} ${source.description} ${creditNames} ` : ''}${section.text}`,
        contentLocale: source.locale ?? docsyConfig.localization?.defaultLocale ?? docsyConfig.site.language,
        isFallback: (source.locale ?? docsyConfig.localization?.defaultLocale ?? docsyConfig.site.language) !== context.locale,
        url: `${url}${section.id ? `#${encodeURIComponent(section.id)}` : ''}`, ...context, ...links(articleRoute(source)),
      }));
    }
    const spec = await loadSwagger(context.version);
    for (const section of API_SECTIONS) for (const endpoint of filterEndpoints(spec, section)) records.push({
      id: `${context.version}:${context.locale}:api:${endpoint.id}`, type: 'api', title: endpoint.summary || endpoint.path,
      url: `${docsPath(`/api/${section.section}`, context)}#${endpoint.id}`, group: section.title,
      body: [endpoint.description ?? '', endpoint.path, ...[...endpoint.pathParams, ...endpoint.queryParams, ...endpoint.headerParams, ...endpoint.bodyProperties].map((p) => `${p.name} ${p.description ?? ''}`), ...endpoint.requestExamples.map((example) => `${example.label} ${example.code}`), endpoint.responseExample ?? ''].join(' '),
      method: endpoint.method.toUpperCase(), path: endpoint.path, ...context, ...links(`/api/${section.section}`),
    });
    for (const source of getSdkSources()) {
      const sdk = loadSdk({ ...source, source: source.versions[context.version] ?? source.source });
      records.push({ id: `${context.version}:${context.locale}:sdk:${source.id}:overview`, type: 'sdk', kind: 'overview', title: sdk.name, group: sdk.name,
        url: docsPath(`/${source.slug}`, context), body: [sdk.overview, sdk.install, sdk.quickstart?.code].filter(Boolean).join(' '), ...context, ...links(`/${source.slug}`) });
      for (const category of sdk.categories) for (const item of category.items) records.push({
        id: `${context.version}:${context.locale}:sdk:${source.id}:${item.id}`, type: 'sdk', kind: item.kind,
        title: item.name, group: `${sdk.name} · ${category.title}`, url: `${docsPath(`/${source.slug}`, context)}#${item.id}`,
        body: [item.summary, item.remarks, item.declaration, item.example, item.returnsDoc, ...item.throws?.map((error) => `${error.type} ${error.description || ''}`) ?? [], ...item.parameters?.map((p) => `${p.name} ${p.type} ${p.description ?? ''}`) ?? [], ...item.relationships?.map((relation) => relation.name) ?? [], ...item.methods?.map((method) => `${method.name} ${method.description || ''}`) ?? [], ...item.properties?.map((property) => `${property.name} ${property.description || ''}`) ?? []].filter(Boolean).join(' '),
        ...context, ...links(`/${source.slug}`),
      });
    }
    const home = { ...docsyConfig.home, ...docsyConfig.home.translations[context.locale] };
    records.push({ id: `${context.version}:${context.locale}:home`, type: 'page', title: home.title, group: docsyConfig.site.name, url: docsPath('/', context), body: home.description, ...context, ...links('/') });
  }
  return records;
}
