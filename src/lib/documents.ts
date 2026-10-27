import { allContexts, docsPath, parseDocsPath, type DocsContext } from '../config';
import { articleRoute, getArticleSources } from './article-loader';
import { getSdkSources } from './sdk-loaders';
import { API_SECTIONS } from './swagger-loader';
export type DocumentRoute = { key: string; path: string; route: string; context: DocsContext };
export const markdownPath = (key: string) => docsPath(`/format-md/${key}.md`);
export const documentKey = (path: string) => {
  const relative = (docsPath() === '/' ? path : path.slice(docsPath().length)).replace(/^\/+/, '');
  return parseDocsPath(path)?.path === '/' ? `${relative ? `${relative}/` : ''}index` : relative;
};
export function getDocuments(): DocumentRoute[] {
  return allContexts.flatMap((context) => ['/', ...getArticleSources(context).map(articleRoute), ...API_SECTIONS.map((section) => `/api/${section.section}`), ...getSdkSources().map((sdk) => `/${sdk.slug}`)].map((route) => {
    const path = docsPath(route, context);
    return { key: documentKey(path), path, route, context };
  }));
}
