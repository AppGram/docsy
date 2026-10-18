import test from 'node:test';
import assert from 'node:assert/strict';
import { docsPath, docsyConfig } from '../src/config';
import { API_BASE_URL, API_SECTIONS, filterEndpoints, loadSwagger } from '../src/lib/swagger-loader';
import { generateMarkdown } from '../src/lib/markdown-export';
import { buildCorpus } from '../src/lib/corpus';
import { searchRecords } from '../src/lib/search';

test('portal OpenAPI sample validates and includes read and write request examples', async () => {
  const spec = await loadSwagger();
  assert.ok(spec);
  assert.equal(API_BASE_URL, 'https://jsonplaceholder.typicode.com');
  const posts = API_SECTIONS.find((section) => section.section === 'posts')!;
  const endpoints = filterEndpoints(spec, posts);
  assert.equal(endpoints.length, 6);
  assert.deepEqual([...new Set(endpoints.map((endpoint) => endpoint.method))].sort(), ['delete', 'get', 'patch', 'post', 'put']);
  assert.ok(endpoints.every((endpoint) => !endpoint.needsAuth && !endpoint.curl.includes('Authorization')));
  const create = endpoints.find((endpoint) => endpoint.method === 'post')!;
  assert.match(create.curl, /Content-Type: application\/json/);
  assert.match(create.curl, /"title": "Hello from Docsy"/);
  assert.deepEqual(create.bodyProperties.filter((property) => property.required).map((property) => property.name), ['title', 'body', 'userId']);
  assert.equal(create.successCode, '201');
  assert.equal(JSON.parse(create.responseExample!).id, 101);
  assert.equal(endpoints.find((endpoint) => endpoint.method === 'delete')!.responseExample, '{}');
});

test('OpenAPI sample curl uses actual path IDs and optional query examples', async () => {
  const spec = await loadSwagger();
  for (const section of API_SECTIONS) {
    const endpoints = filterEndpoints(spec, section);
    assert.ok(endpoints.length);
    assert.ok(endpoints.every((endpoint) => !endpoint.curl.includes('{id}')));
    if (section.section === 'posts') {
      assert.ok(endpoints.some((endpoint) => endpoint.curl.includes('/posts?userId=1')));
      assert.ok(endpoints.some((endpoint) => endpoint.path === '/posts/{id}' && endpoint.curl.includes('/posts/1')));
    } else assert.match(endpoints[0].curl, /\/comments\?postId=1/);
  }
});

test('OpenAPI request examples reach Markdown and contextual full-text search', async () => {
  const markdown = await generateMarkdown(docsPath('/api/posts'), docsyConfig.site.origin);
  assert.match(markdown!, /curl --request POST/);
  assert.match(markdown!, /Hello from Docsy/);
  assert.match(markdown!, /simulated/);
  const corpus = await buildCorpus();
  const results = searchRecords(corpus, 'Hello from Docsy', { version: 'current', locale: 'es', type: 'api' });
  assert.ok(results.some((result) => result.url.includes('/versions/current/es/api/posts')));
  assert.ok(results.every((result) => result.type === 'api' && result.locale === 'es'));
});
