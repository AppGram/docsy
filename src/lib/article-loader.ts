import { readFileSync } from 'node:fs';
import { createMarkdownProcessor, type MarkdownHeading } from '@astrojs/markdown-remark';
import { defaultContext, docsPath, docsyConfig, resolveSource, type ArticleConfig, type DocsContext } from '../config';
import { expandSnippets, plainMarkdown, richPlugins } from './rich-markdown';
import { highlightArticles } from './code-renderer';
import { authorshipMarkdown } from './authorship';

export type ArticleDoc = {
  config: ArticleConfig;
  markdown: string;
  html: string;
  headings: MarkdownHeading[];
};

const processor = createMarkdownProcessor({ syntaxHighlight: false, remarkPlugins: richPlugins as any, rehypePlugins: [highlightArticles] });

export const getArticleSources = (context: DocsContext = defaultContext): ArticleConfig[] => {
  const slugs = [...new Set(docsyConfig.content.articles.map((article) => article.slug))];
  return slugs.flatMap((slug) => {
    const entries = docsyConfig.content.articles.filter((article) => article.slug === slug);
    const versioned = entries.filter((article) => article.version === context.version);
    const pool = versioned.length ? versioned : entries.filter((article) => !article.version);
    const exact = pool.find((article) => (article.locale ?? defaultContext.locale) === context.locale);
    const fallback = docsyConfig.localization?.fallback !== false ? pool.find((article) => (article.locale ?? defaultContext.locale) === defaultContext.locale) : undefined;
    return exact || fallback ? [exact ?? fallback!] : [];
  });
};

export const articleRoute = (article: ArticleConfig): string => `/guides/${article.slug}`;

export const articleUrl = (article: ArticleConfig, context: DocsContext = defaultContext): string => docsPath(articleRoute(article), context);

export const findArticle = (slug: string, context: DocsContext = defaultContext): ArticleConfig | undefined =>
  getArticleSources(context).find((article) => article.slug === slug);

export const readArticleMarkdown = (article: ArticleConfig): string => {
  try {
    const source = readFileSync(resolveSource(article.source), 'utf8').trim();
    return /\.mdx$/i.test(article.source) ? source : expandSnippets(source);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not load Docsy article "${article.slug}" from ${article.source}: ${reason}`);
  }
};

export const loadArticle = async (article: ArticleConfig): Promise<ArticleDoc> => {
  const markdown = readArticleMarkdown(article);
  if (/\.mdx$/i.test(article.source)) {
    try {
      const { renderMdx } = await import('./mdx-renderer');
      return { config: article, ...await renderMdx(markdown, resolveSource(article.source)) };
    } catch (error) {
      throw new Error(`Could not render MDX article "${article.slug}" (${article.source}): ${error instanceof Error ? error.message : error}`);
    }
  }
  const rendered = await (await processor).render(markdown);
  return {
    config: article,
    markdown,
    html: rendered.code,
    headings: rendered.metadata.headings,
  };
};

export const articleMarkdownExport = async (article: ArticleConfig): Promise<string> => {
  const body = /\.mdx$/i.test(article.source) ? (await loadArticle(article)).markdown : plainMarkdown(readArticleMarkdown(article));
  const description = article.description ? `\n\n${article.description}` : '';
  const credits = authorshipMarkdown(article);
  return `# ${article.title}${description}${credits ? `\n\n${credits}` : ''}\n\n${body}\n`;
};
