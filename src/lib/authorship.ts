import { assetPath, defaultContext, docsPath, docsyConfig, type ArticleConfig, type AuthorConfig, type DocsContext } from '../config';

export type AuthorProfile = Omit<AuthorConfig, 'avatar'> & { id: string; avatar?: string; url?: string };
export const resolveAuthor = (id: string): AuthorProfile => {
  const author = docsyConfig.authors[id];
  if (!author) throw new Error(`Unknown author: ${id}`);
  const avatar = author.avatar ?? docsyConfig.reader.defaultAuthorAvatar;
  return { ...author, id, url: author.url ?? (author.github ? `https://github.com/${author.github}` : undefined), avatar: avatar ? assetPath(avatar) : undefined };
};
export function articleAuthorship(article: ArticleConfig) {
  return {
    authors: (article.authors ?? []).map(resolveAuthor),
    contributors: (article.contributors ?? []).map(resolveAuthor),
    reviewedBy: (article.reviewedBy ?? []).map(resolveAuthor),
    publishedAt: article.publishedAt, updatedAt: article.updatedAt, reviewedAt: article.reviewedAt,
    provenance: article.provenance ? { ...article.provenance, agent: resolveAuthor(article.provenance.agent) } : undefined,
  };
}
export type ArticleAuthorship = ReturnType<typeof articleAuthorship>;
const text = (value: string) => value.replace(/[\r\n]+/g, ' ').replace(/[\\`*_\[\]<>]/g, '\\$&');
const link = (author: AuthorProfile) => author.url ? `[${text(author.name)}](${author.url.replace(/\(/g, '%28').replace(/\)/g, '%29')})` : text(author.name);
export function authorshipMarkdown(article: ArticleConfig): string {
  const credits = articleAuthorship(article);
  const people = (authors: AuthorProfile[]) => authors.map((author) => `${link(author)}${author.kind === 'agent' ? ' (coding agent)' : ''}`).join(', ');
  return [
    credits.authors.length ? `Written by: ${people(credits.authors)}` : '',
    credits.contributors.length ? `Contributors: ${people(credits.contributors)}` : '',
    credits.reviewedBy.length ? `Reviewed by: ${people(credits.reviewedBy)}${credits.reviewedAt ? ` (${credits.reviewedAt})` : ''}` : '',
    credits.publishedAt ? `Published: ${credits.publishedAt}` : '',
    credits.updatedAt ? `Updated: ${credits.updatedAt}` : '',
    credits.provenance ? `Agent provenance: ${people([credits.provenance.agent])}${credits.provenance.model ? `; model: ${text(credits.provenance.model)}` : ''}${credits.provenance.referenceUrl ? `; reference: ${credits.provenance.referenceUrl}` : ''}` : '',
  ].filter(Boolean).join('\n\n');
}
export function articleStructuredData(article: ArticleConfig, context: DocsContext = defaultContext) {
  const credits = articleAuthorship(article);
  // Do not misrepresent an agent as a human author in structured data.
  const authors = credits.authors.filter((author) => author.kind !== 'agent').map((author) => ({ '@type': author.kind === 'human' ? 'Person' : 'Organization', name: author.name, url: author.url }));
  return {
    '@context': 'https://schema.org', '@type': 'TechArticle', headline: article.title, description: article.description,
    url: new URL(docsPath(`/guides/${article.slug}`, context), docsyConfig.site.origin).href,
    author: authors.length ? authors : undefined,
    datePublished: article.publishedAt, dateModified: article.updatedAt,
    inLanguage: article.locale ?? defaultContext.locale,
  };
}
