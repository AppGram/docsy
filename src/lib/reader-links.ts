import { defaultContext, docsPath, docsyConfig, type DocsContext } from '../config';
import type { ArticleDoc } from './article-loader';

export const readerLinks = (article: Pick<ArticleDoc, 'config'>, context: DocsContext = defaultContext) => {
  const path = docsPath(`/guides/${article.config.slug}`, context);
  // Never forward auth/search query parameters or infer an upstream repository.
  const page = new URL(path, docsyConfig.site.origin).href;
  const values: Record<string, string> = { source: article.config.source.split('/').map(encodeURIComponent).join('/'), version: encodeURIComponent(context.version), locale: encodeURIComponent(context.locale) };
  const template = article.config.editUrl === false || !docsyConfig.reader.editEnabled ? undefined : article.config.editUrl ?? docsyConfig.reader.editUrl;
  const edit = template?.replace(/\{(source|version|locale)\}/g, (_, key) => values[key]);
  let report: string | undefined;
  if (docsyConfig.reader.reportUrl) {
    const url = new URL(docsyConfig.reader.reportUrl);
    url.searchParams.set('title', `Docs: ${article.config.title}`);
    url.searchParams.set('body', `Page: ${page}\nVersion: ${context.version}\nLanguage: ${context.locale}\n\nWhat needs correcting?\n\n`);
    report = url.href;
  }
  return { edit, report };
};
