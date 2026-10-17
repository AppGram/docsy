import type { APIRoute } from 'astro';
import { docsPath, docsyConfig } from '../config';
import { docsNav } from '../data/docs-nav';
import { accessPathForRequest, canAccessPath, relativeDocsPath } from '../lib/access';
import { articleUrl, getArticleSources, loadArticle } from '../lib/article-loader';
import { getSdkSources, loadSdk } from '../lib/sdk-loaders';
import { loadSwagger, filterEndpoints, API_SECTIONS } from '../lib/swagger-loader';

export const prerender = docsyConfig.access.mode !== 'locked';

export type SearchEntry =
  | { type: 'page'; title: string; url: string; group: string; kind?: string; summary?: string }
  | { type: 'sdk'; title: string; url: string; group: string; kind: string; sdk: string; summary?: string }
  | { type: 'api'; title: string; url: string; group: string; method: string; path: string; summary?: string };

export const GET: APIRoute = async ({ locals }) => {
  const entries: SearchEntry[] = [];
  const articleMetadata = new Map(getArticleSources().map((article) => [articleUrl(article), article]));

  // 1. Sidebar navigation
  for (const section of docsNav) {
    for (const item of section.items) {
      const article = articleMetadata.get(item.href);
      entries.push({
        type: 'page',
        title: item.title,
        url: item.href,
        group: section.title,
        kind: article ? 'article' : undefined,
        summary: article?.description,
      });
      for (const sub of item.items ?? []) {
        const subArticle = articleMetadata.get(sub.href);
        entries.push({
          type: 'page',
          title: sub.title,
          url: sub.href,
          group: `${section.title} · ${item.title}`,
          kind: subArticle ? 'article' : undefined,
          summary: subArticle?.description,
        });
      }
    }
  }

  // 2. Authored Markdown articles and their headings
  const pageUrls = new Set(entries.filter((entry) => entry.type === 'page').map((entry) => entry.url));
  for (const source of getArticleSources()) {
    const url = articleUrl(source);
    if (!pageUrls.has(url)) {
      entries.push({
        type: 'page',
        title: source.title,
        url,
        group: 'Guides',
        kind: 'article',
        summary: source.description,
      });
    }
    const article = await loadArticle(source);
    for (const heading of article.headings.filter((candidate) => candidate.depth === 2 || candidate.depth === 3)) {
      entries.push({
        type: 'page',
        title: heading.text,
        url: `${url}#${heading.slug}`,
        group: source.title,
        kind: 'section',
        summary: source.description,
      });
    }
  }

  // 3. SDK symbols
  const sdks = getSdkSources().map((source) => ({
    label: source.name,
    slug: source.slug,
    doc: loadSdk(source),
  }));
  for (const { label, slug, doc } of sdks) {
    for (const cat of doc.categories) {
      for (const item of cat.items) {
        entries.push({
          type: 'sdk',
          title: item.name,
          url: `${docsPath(`/${slug}`)}#${item.id}`,
          group: `${label} · ${cat.title}`,
          kind: item.kind,
          sdk: label,
          summary: item.summary,
        });
      }
    }
  }

  // 4. REST API endpoints
  const spec = await loadSwagger();
  for (const section of API_SECTIONS) {
    const endpoints = filterEndpoints(spec, section);
    for (const ep of endpoints) {
      entries.push({
        type: 'api',
        title: ep.summary || ep.path,
        url: `${docsPath(`/api/${section.section}`)}#${ep.id}`,
        group: `API · ${section.title}`,
        method: ep.method.toUpperCase(),
        path: ep.path,
        summary: ep.description,
      });
    }
  }

  const tiers = locals.docsyAccess?.tiers ?? [];
  const visibleEntries = entries.filter((entry) => {
    const pathname = new URL(entry.url, docsyConfig.site.origin).pathname;
    const relative = relativeDocsPath(pathname);
    return relative === null || canAccessPath(accessPathForRequest(relative), tiers);
  });

  return new Response(JSON.stringify({ entries: visibleEntries, count: visibleEntries.length }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
