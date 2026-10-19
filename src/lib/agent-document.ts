import { docsyConfig, docsPath } from '../config';
import { getDocuments, type DocumentRoute } from './documents';
import { generateMarkdown } from './markdown-export';
import { findArticle } from './article-loader';
import { articleAuthorship } from './authorship';
import { readerLinks } from './reader-links';
export async function readAgentDocument(document: DocumentRoute, tiers: string[] = []) {
  const markdown = await generateMarkdown(document.path, docsyConfig.site.origin, tiers);
  if (markdown === null) throw new Error(`No Markdown export for ${document.path}`);
  const article = document.route.startsWith('/guides/') ? findArticle(document.route.slice(8), document.context) : undefined;
  const contentLocale = article?.locale ?? docsyConfig.localization?.defaultLocale ?? docsyConfig.site.language;
  return {
    schemaVersion: 1, title: markdown.match(/^#\s+(.+)/m)?.[1] ?? document.route,
    url: new URL(document.path, docsyConfig.site.origin).href,
    markdownUrl: new URL(docsPath(`/format-md/${document.key}`), docsyConfig.site.origin).href,
    jsonUrl: new URL(docsPath(`/agent/pages/${document.key}.json`), docsyConfig.site.origin).href,
    ...document.context, markdown,
    ...(article ? { contentLocale, isFallback: contentLocale !== document.context.locale, authorship: articleAuthorship(article), editUrl: readerLinks({ config: article }, document.context).edit } : {}),
  };
}
export const findDocument = (key: string) => getDocuments().find((document) => document.key === key);
