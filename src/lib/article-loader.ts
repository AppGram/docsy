import { readFileSync } from 'node:fs';
import { createMarkdownProcessor, type MarkdownHeading } from '@astrojs/markdown-remark';
import { docsPath, docsyConfig, resolveSource, type ArticleConfig } from '../config';

export type ArticleDoc = {
  config: ArticleConfig;
  markdown: string;
  html: string;
  headings: MarkdownHeading[];
};

const processor = createMarkdownProcessor({ syntaxHighlight: false });

export const getArticleSources = (): ArticleConfig[] => docsyConfig.content.articles;

export const articleRoute = (article: ArticleConfig): string => `/guides/${article.slug}`;

export const articleUrl = (article: ArticleConfig): string => docsPath(articleRoute(article));

export const findArticle = (slug: string): ArticleConfig | undefined =>
  getArticleSources().find((article) => article.slug === slug);

export const readArticleMarkdown = (article: ArticleConfig): string => {
  try {
    return readFileSync(resolveSource(article.source), 'utf8').trim();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not load Docsy article "${article.slug}" from ${article.source}: ${reason}`);
  }
};

export const loadArticle = async (article: ArticleConfig): Promise<ArticleDoc> => {
  const markdown = readArticleMarkdown(article);
  const rendered = await (await processor).render(markdown);
  return {
    config: article,
    markdown,
    html: rendered.code,
    headings: rendered.metadata.headings,
  };
};

export const articleMarkdownExport = (article: ArticleConfig): string => {
  const body = readArticleMarkdown(article);
  const description = article.description ? `\n\n${article.description}` : '';
  return `# ${article.title}${description}\n\n${body}\n`;
};
