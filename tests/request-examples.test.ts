import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { generateRequestExamples, type ExampleRequest } from '../src/lib/request-examples';
import { REQUEST_LANGUAGES } from '../src/lib/request-languages';
import { docsyConfig, docsPath } from '../src/config';
import { filterEndpoints, API_SECTIONS, loadSwagger } from '../src/lib/swagger-loader';
import { generateMarkdown } from '../src/lib/markdown-export';

const request: ExampleRequest = { method: 'POST', url: 'https://example.test/posts?userId=1', headers: [{ name: 'Content-Type', value: 'application/json' }, { name: 'X-Example', value: 'Docsy' }], body: JSON.stringify({ title: "reader's \"guide\"", body: 'line 1\nline 2 $name #{unsafe}', userId: 1 }), mimeType: 'application/json' };
for (const language of REQUEST_LANGUAGES) test(`OpenAPI request generator: ${language}`, () => {
  const [example] = generateRequestExamples(request, [language], 'curl --request POST https://example.test/posts');
  assert.ok(example.code.length > 20); assert.ok(example.label); assert.equal(example.source, 'generated');
  assert.match(example.code, /example\.test/); assert.match(example.code, /POST|post/);
  if (language !== 'curl') assert.match(example.code, /reader|title/);
});

test('Dart and Elixir payload interpolation is escaped', () => {
  const [dart] = generateRequestExamples(request, ['dart'], '');
  assert.ok(dart.code.includes('\\$name'));
  const [elixir] = generateRequestExamples(request, ['elixir'], '');
  assert.ok(elixir.code.includes('\\#{unsafe}'));
});

test('fetch request payloads preserve quotes, newlines and scalar/empty JSON exactly', async () => {
  for (const body of [request.body!, 'false', 'null', '{}', '[]', '{"__proto__":{"safe":true}}']) {
    for (const language of ['javascript', 'typescript', 'node'] as const) {
      const [example] = generateRequestExamples({ ...request, body }, [language], '');
      let actual: string | undefined;
      const context = { fetch: async (_url: string, options: { body: string }) => { actual = options.body; return { ok: true, text: async () => 'ok' }; }, console: { log() {} } };
      await vm.runInNewContext(`(async () => { ${example.code} })()`, context);
      assert.equal(actual, body);
    }
  }
});

test('form request generators retain fields instead of silently dropping the payload', () => {
  const form: ExampleRequest = { method: 'POST', url: 'https://example.test/form', headers: [{ name: 'Content-Type', value: 'application/x-www-form-urlencoded' }], mimeType: 'application/x-www-form-urlencoded', body: 'name=Docsy&enabled=false' };
  for (const language of REQUEST_LANGUAGES.filter((language) => language !== 'curl')) {
    const [example] = generateRequestExamples(form, [language], '');
    assert.ok(example.code.includes('Docsy'), `${language} lost the form fields`);
  }
  const multipart = generateRequestExamples({ ...form, mimeType: 'multipart/form-data', body: undefined, headers: [], formFields: [{ name: 'title', value: 'Docsy' }, { name: 'file', value: '<file-contents>', fileName: 'example.txt' }] }, ['python', 'swift', 'dart', 'fsharp', 'visualbasic'], '');
  assert.ok(multipart.every((example) => example.code.includes('Docsy') && example.code.includes('boundary')));
});

test('x-codeSamples overrides selected languages without hiding other generated examples', () => {
  const examples = generateRequestExamples(request, ['curl', 'python'], 'curl example', [{ lang: 'py', label: 'Official SDK', source: 'client.posts.create(title="Docsy")' }]);
  assert.equal(examples[0].source, 'generated'); assert.equal(examples[1].source, 'custom');
  assert.equal(examples[1].label, 'Official SDK'); assert.match(examples[1].code, /client.posts.create/);
});

test('GET snippets have no fabricated JSON payload and preserve encoded URL parameters', () => {
  const examples = generateRequestExamples({ method: 'GET', url: 'https://example.test/items/a%2Fb?q=x%26y', headers: [] }, ['javascript', 'python', 'go', 'dart', 'fsharp', 'visualbasic'], '');
  for (const example of examples) { assert.match(example.code, /a%2Fb/); assert.ok(!example.code.includes('%252F')); }
  assert.ok(!examples[0].code.includes('JSON.stringify'));
  assert.ok(!examples.find((example) => example.language === 'dart')!.code.includes('request.body ='));
});

test('portal OpenAPI normalization and Markdown include every YAML-selected request language', async () => {
  const endpoints = filterEndpoints(await loadSwagger(), API_SECTIONS[0]);
  assert.equal(docsyConfig.ingestion.openapi.examples.languages.length, 24);
  assert.ok(endpoints.every((endpoint) => endpoint.requestExamples.length === 24));
  const markdown = await generateMarkdown(docsPath('/api/posts'), docsyConfig.site.origin);
  assert.match(markdown!, /Python · requests/); assert.match(markdown!, /Kotlin · OkHttp/); assert.match(markdown!, /Swift · URLSession/);
});
