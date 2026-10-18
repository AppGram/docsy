import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { codeLanguage } from '../src/lib/code-languages';
import { highlightArticles, renderCodeCard } from '../src/lib/code-renderer';
import { htmlTree, attribute, textContent, walkHtml } from '../src/lib/html-content';
import { docsyConfig } from '../src/config';
import { loadSdk } from '../src/lib/sdk-loaders';
import { REQUEST_LANGUAGES } from '../src/lib/request-languages';
import { richPlugins } from '../src/lib/rich-markdown';
import { loadArticle } from '../src/lib/article-loader';
import { API_SECTIONS, filterEndpoints, loadSwagger } from '../src/lib/swagger-loader';

function inspect(html: string) {
  const root = htmlTree(html); const nodes: ReturnType<typeof htmlTree>[] = [];
  walkHtml(root, (node) => nodes.push(node));
  const code = nodes.find((node) => node.tagName === 'code')!;
  return { nodes, code, source: textContent(code), tokens: nodes.filter((node) => attribute(node, 'class')?.split(' ').includes('cb-token')) };
}

for (const sdk of docsyConfig.ingestion.sdks.filter((sdk) => sdk.adapter !== 'typedoc-lite')) test(`${sdk.language}: native declarations and examples are highlighted with local language logos`, async () => {
  const items = loadSdk(sdk).categories.flatMap((category) => category.items);
  const item = items.find((item) => /greet[_]?many/i.test(item.name) && item.example)!;
  assert.ok(item, sdk.language);
  for (const [code, language] of [[item.declaration!, item.language], [item.example!, item.exampleLanguage || item.language]]) {
    const info = codeLanguage(language);
    assert.notEqual(info.grammar, 'text'); assert.ok(info.icon);
    const output = await renderCodeCard(code, language, 'Declaration');
    const view = inspect(output);
    assert.equal(view.source, code, `${sdk.language}: copying must preserve the original source`);
    assert.equal(attribute(view.code, 'data-highlighted'), 'shiki');
    assert.ok(view.tokens.length > 1);
    assert.ok(new Set(view.tokens.map((token) => attribute(token, 'style'))).size > 1, `Only one color for ${sdk.language}`);
    assert.ok(view.tokens.every((token) => /--syntax-light:.*;--syntax-dark:/.test(attribute(token, 'style')!)));
    assert.ok(view.nodes.some((node) => node.tagName === 'span' && attribute(node, 'role') === 'img' && attribute(node, 'aria-label') === info.label));
    assert.ok(view.nodes.some((node) => node.tagName === 'img' && attribute(node, 'src') === info.icon));
    assert.match(readFileSync(`public/${info.icon!.replace(/^\/docsy\//, '')}`, 'utf8'), /<svg/);
  }
});

test('all configured OpenAPI request languages have a real grammar; aliases retain the right identity', () => {
  for (const language of REQUEST_LANGUAGES) assert.notEqual(codeLanguage(language).grammar, 'text', language);
  for (const [alias, grammar, label] of [['ts', 'typescript', 'TypeScript'], ['vbnet', 'vb', 'Visual Basic'], ['objc', 'objective-c', 'Objective-C'], ['shell', 'shellscript', 'Shell'], ['jsonc', 'jsonc', 'JSON'], ['nodejs', 'javascript', 'Node.js']]) {
    assert.equal(codeLanguage(alias).grammar, grammar); assert.equal(codeLanguage(alias).label, label);
  }
});

test('every actual OpenAPI POST request target renders colored tokens and preserves its generated program', async () => {
  const endpoint = filterEndpoints(await loadSwagger(), API_SECTIONS[0]).find((endpoint) => endpoint.method.toUpperCase() === 'POST')!;
  assert.equal(endpoint.requestExamples.length, 24);
  for (const example of endpoint.requestExamples) {
    const view = inspect(await renderCodeCard(example.code, example.language, 'Request'));
    assert.equal(view.source, example.code, example.language);
    assert.ok(view.tokens.length > 1, example.language);
    assert.ok(new Set(view.tokens.map((token) => attribute(token, 'style'))).size > 1, example.language);
    const info = codeLanguage(example.language);
    if (info.icon) assert.match(readFileSync(`public/${info.icon.replace(/^\/docsy\//, '')}`, 'utf8'), /<svg/);
  }
});

test('rendering preserves exact whitespace and safely escapes code, titles and unknown languages', async () => {
  const source = '\tconst message = "<script>alert(1)</script> & >";\r\n\r\nconsole.log(message);\r\n';
  const output = await renderCodeCard(source, 'typescript', '<b>Unsafe title</b>');
  // HTML normalizes CRLF to LF. Tabs, blank lines, escapes and trailing newline
  // remain unchanged; copy reads the plain source, not token markup.
  assert.equal(inspect(output).source, source.replace(/\r\n/g, '\n'));
  assert.doesNotMatch(output, /<script>|<b>Unsafe/); assert.match(output, /&#x3C;script>|&lt;script>/);
  const plain = await renderCodeCard(source, 'not-a-language');
  assert.equal(inspect(plain).source, source.replace(/\r\n/g, '\n')); assert.equal(inspect(plain).tokens.length, 0);
  assert.equal(attribute(inspect(plain).code, 'data-highlighted'), 'plain');
  const other = inspect(await renderCodeCard(source, 'typescript'));
  assert.notEqual(attribute(inspect(output).code, 'id'), attribute(other.code, 'id'));
  assert.equal(inspect(await renderCodeCard('x'.repeat(100_001), 'typescript')).tokens.length, 0);
});

test('Markdown fences, code groups and nested article components share the same code renderer', async () => {
  const processor = await createMarkdownProcessor({ syntaxHighlight: false, remarkPlugins: richPlugins as any, rehypePlugins: [highlightArticles] });
  const markdown = ':::note[Read]\n```yaml\nname: Docsy\nenabled: true\n```\n:::\n\n:::code-group\n```ts Client.ts\nconst message: string = "hello";\n```\n```python client.py\nprint("hello")\n```\n:::\n\n```unknown\n<not-html>\n```\n';
  const rendered = (await processor.render(markdown)).code;
  assert.equal((rendered.match(/class="cb"/g) || []).length, 4);
  assert.equal((rendered.match(/data-highlighted="shiki"/g) || []).length, 3);
  assert.match(rendered, /data-highlighted="plain"/);
  assert.match(rendered, /docsy-callout/); assert.match(rendered, /docsy-tabs/);
  assert.match(rendered, /aria-label="YAML"/); assert.match(rendered, /typescript\.svg/);
  assert.doesNotMatch(rendered, /<not-html>/);
});

test('the actual portal article uses build-time tokens and the layout has no highlighter CDN', async () => {
  const article = await loadArticle(docsyConfig.content.articles.find((article) => article.slug === 'tutorials/rich-articles')!);
  assert.match(article.html, /data-highlighted="shiki"/); assert.match(article.html, /class="cb-token"/);
  const layout = readFileSync('src/layouts/DocsLayout.astro', 'utf8');
  assert.doesNotMatch(layout, /highlight\.min\.js|highlightjs|window\.hljs|cdn\.jsdelivr/);
});
