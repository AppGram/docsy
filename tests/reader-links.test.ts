import test from 'node:test';
import assert from 'node:assert/strict';
import { readerLinks } from '../src/lib/reader-links';
import { getArticleSources, loadArticle } from '../src/lib/article-loader';
import { docsyConfig, docsPath } from '../src/config';

test('reader links retain translated source and canonical version/locale without request queries', async () => {
  const context = { version: 'current', locale: 'es' };
  const article = await loadArticle(getArticleSources(context).find((item) => item.slug === 'getting-started')!);
  const links = readerLinks(article, context);
  assert.ok(links.edit?.includes(article.config.source));
  const report = new URL(links.report!);
  assert.equal(report.origin, 'https://github.com');
  assert.match(report.searchParams.get('body')!, /Version: current\nLanguage: es/);
  assert.ok(report.searchParams.get('body')!.includes(new URL(docsPath('/guides/getting-started', context), docsyConfig.site.origin).href));
  assert.ok(!report.searchParams.get('body')!.includes('returnTo='));
});
