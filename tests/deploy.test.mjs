import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { load } from 'js-yaml';
import { buildManifest, contentType, deploy, deployConfig, fetchRetry, LIMITS, parseArgs } from '../scripts/deploy.mjs';

const temporary = [];
const temp = () => { const root = mkdtempSync(join(tmpdir(), 'docsy-deploy-')); temporary.push(root); return root; };
afterEach(() => { for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true }); });
const write = (root, path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
const sha = (text) => createHash('sha256').update(text).digest('hex');
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const project = (config = 'site:\n  name: Demo\n  origin: https://example.com\n  basePath: /docs\naccess:\n  mode: open\n') => {
  const root = temp();
  write(root, 'docsy.config.yaml', config);
  write(root, 'release/developers/index.html', '<h1>Home</h1>');
  write(root, 'release/developers/guides/intro/index.html', '<h1>Intro</h1>');
  write(root, 'release/developers/_astro/app.abc123.js', 'console.log(1)');
  write(root, 'release/developers/404.html', 'missing');
  write(root, 'release/index.html', 'root redirect, not part of the mount');
  return root;
};

// Records calls; answers like the hosted docs API.
const fakeApi = ({ missing = ['ALL'], finalizeStatus = 200, failFirstPut = false } = {}) => {
  const calls = [];
  let putFailures = failFirstPut ? 1 : 0;
  const fetchImpl = async (url, init = {}) => {
    const method = init.method || 'GET';
    calls.push({ url: String(url), method, headers: init.headers, body: init.body });
    if (String(url).startsWith('https://r2.test/')) {
      if (putFailures-- > 0) return new Response('busy', { status: 503 });
      return new Response(null, { status: 200 });
    }
    const path = new URL(url).pathname;
    if (method === 'GET' && path === '/api/v1/projects/p1/docs') return json(200, { success: true, data: { site: null, url: 'https://acme.appgram.page/developers/', deploys: [] } });
    if (method === 'POST' && path === '/api/v1/projects/p1/docs/deploys') {
      const body = JSON.parse(init.body);
      const want = missing[0] === 'ALL' ? body.files.map((f) => f.sha256) : missing;
      return json(200, { success: true, data: { deploy: { id: 'd1', status: 'uploading' }, uploads: want.map((s) => ({ sha256: s, url: `https://r2.test/${s}`, method: 'PUT', headers: { 'Content-Type': 'x/test' } })) } });
    }
    if (method === 'POST' && path === '/api/v1/projects/p1/docs/deploys/d1/finalize') {
      if (finalizeStatus === 409) return json(409, { success: false, error: { code: 'CONFLICT', message: 'Some files were not uploaded', details: { missing: ['f'.repeat(64)] } } });
      return json(200, { success: true, data: { deploy: { id: 'd1', status: 'ready', active: true } } });
    }
    return json(404, { success: false, error: { code: 'NOT_FOUND', message: `no route ${method} ${path}` } });
  };
  return { calls, fetchImpl };
};

const run = (root, api, args = ['--project', 'p1', '--no-build'], env = {}) => deploy(args, {
  root, fetchImpl: api.fetchImpl, env: { APPGRAM_API_KEY: 'k', APPGRAM_API_URL: 'https://api.test', ...env }, log: () => {}, retryDelay: 1,
  build: () => assert.fail('build should not run'),
});

test('manifest hashes the /developers mount with relative paths and content types', () => {
  const root = project();
  const { files, totalBytes } = buildManifest(join(root, 'release/developers'));
  assert.deepEqual(files.map((f) => f.path), ['404.html', '_astro/app.abc123.js', 'guides/intro/index.html', 'index.html']);
  const index = files.find((f) => f.path === 'index.html');
  assert.equal(index.sha256, sha('<h1>Home</h1>'));
  assert.equal(index.size, 13);
  assert.equal(index.content_type, 'text/html; charset=utf-8');
  assert.equal(totalBytes, files.reduce((n, f) => n + f.size, 0));
});

test('content types come from the extension map', () => {
  assert.equal(contentType('a/b.CSS'), 'text/css; charset=utf-8');
  assert.equal(contentType('x.woff2'), 'font/woff2');
  assert.equal(contentType('x.svg'), 'image/svg+xml');
  assert.equal(contentType('noext'), 'application/octet-stream');
});

test('manifest enforces per-file limits and needs index.html', () => {
  const root = temp();
  write(root, 'out/big.bin', Buffer.alloc(LIMITS.fileBytes + 1));
  write(root, 'out/index.html', 'x');
  assert.throws(() => buildManifest(join(root, 'out')), /per file/);
  const other = temp();
  write(other, 'out/a.html', 'x');
  assert.throws(() => buildManifest(join(other, 'out')), /no index.html/);
});

test('deploy config forces /developers, the portal origin and the home URL', () => {
  const text = deployConfig('site:\n  name: Demo\n  origin: ${DOCSY_ORIGIN:-https://example.com}\n  basePath: /docs\n  homeUrl: /docs/\n', { origin: 'https://acme.appgram.page' });
  const config = load(text);
  assert.equal(config.site.basePath, '/developers');
  assert.equal(config.site.origin, 'https://acme.appgram.page');
  assert.equal(config.site.homeUrl, '/developers/');
  const kept = load(deployConfig('site:\n  origin: ${DOCSY_ORIGIN:-https://example.com}\n  homeUrl: https://example.com/\n'));
  assert.equal(kept.site.origin, '${DOCSY_ORIGIN:-https://example.com}');
  assert.equal(kept.site.homeUrl, 'https://example.com/');
});

test('locked mode and agent query are refused before any API call', async () => {
  for (const config of ['site:\n  origin: https://e.com\naccess:\n  mode: locked\n', 'site:\n  origin: https://e.com\nagent:\n  query: true\n']) {
    const api = fakeApi();
    await assert.rejects(run(project(config), api), /open \(static\) Docsy sites only/);
    assert.equal(api.calls.length, 0);
  }
});

test('missing API key and project are clear errors', async () => {
  await assert.rejects(deploy(['--project', 'p1'], { root: project(), env: {}, fetchImpl: fakeApi().fetchImpl }), /APPGRAM_API_KEY/);
  assert.throws(() => parseArgs([]), /--project/);
  assert.throws(() => parseArgs(['--project', 'p1', '--bogus']), /Unknown deploy option/);
});

test('deploy posts the manifest, uploads only missing blobs, retries 5xx and finalizes', async () => {
  const root = project('site:\n  name: Demo\n  origin: https://example.com\n  basePath: /developers\n');
  const wanted = sha('<h1>Home</h1>');
  const api = fakeApi({ missing: [wanted], failFirstPut: true });
  const result = await run(root, api, ['--project', 'p1', '--no-build', '--message', 'hello'], { GITHUB_SHA: 'abc', GITHUB_ACTIONS: 'true' });
  const post = api.calls.find((c) => c.method === 'POST' && c.url.endsWith('/docs/deploys'));
  const body = JSON.parse(post.body);
  assert.equal(post.headers['x-api-key'], 'k');
  assert.equal(body.base_path, '/developers');
  assert.equal(body.commit_sha, 'abc');
  assert.equal(body.source, 'github');
  assert.equal(body.message, 'hello');
  assert.equal(body.files.length, 4);
  assert.deepEqual(Object.keys(body.files[0]).sort(), ['content_type', 'path', 'sha256', 'size']);
  const puts = api.calls.filter((c) => c.method === 'PUT');
  assert.equal(puts.length, 2); // one 503, one retry
  assert.equal(puts[1].url, `https://r2.test/${wanted}`);
  assert.equal(puts[1].headers['Content-Type'], 'x/test');
  assert.equal(String(puts[1].body), '<h1>Home</h1>');
  const finalize = api.calls.find((c) => c.url.endsWith('/finalize'));
  assert.deepEqual(JSON.parse(finalize.body), { activate: true });
  assert.equal(result.url, 'https://acme.appgram.page/developers/');
});

test('--no-activate and a finalize 409 surface the API message and missing blobs', async () => {
  const root = project('site:\n  origin: https://example.com\n  basePath: /developers\n');
  const api = fakeApi({ missing: [], finalizeStatus: 409 });
  await assert.rejects(run(root, api, ['--project', 'p1', '--no-build', '--no-activate']), (error) => {
    assert.match(error.message, /Some files were not uploaded/);
    assert.match(error.message, new RegExp('f'.repeat(64)));
    return true;
  });
  const finalize = api.calls.find((c) => c.url.endsWith('/finalize'));
  assert.deepEqual(JSON.parse(finalize.body), { activate: false });
});

test('--no-build refuses output built for another base path', async () => {
  await assert.rejects(run(project(), fakeApi()), /site.basePath \/developers/);
});

test('build runs with a temporary config copy', async () => {
  const root = project();
  const api = fakeApi({ missing: [] });
  let used;
  await deploy(['--project', 'p1'], {
    root, fetchImpl: api.fetchImpl, env: { APPGRAM_API_KEY: 'k', APPGRAM_API_URL: 'https://api.test' }, log: () => {}, retryDelay: 1,
    build: (file) => { used = load(readFileSync(file, 'utf8')); },
  });
  assert.equal(used.site.basePath, '/developers');
  assert.equal(used.site.origin, 'https://acme.appgram.page');
  assert.equal(load(readFileSync(join(root, 'docsy.config.yaml'), 'utf8')).site.basePath, '/docs');
});

test('API error envelopes become readable errors', async () => {
  const api = { fetchImpl: async () => json(403, { success: false, error: { code: 'FORBIDDEN', message: 'API key lacks help_center:manage' } }) };
  await assert.rejects(run(project(), api), /API key lacks help_center:manage/);
});

test('fetchRetry retries network errors then gives up', async () => {
  let n = 0;
  await assert.rejects(fetchRetry('https://x.test', {}, { attempts: 3, delay: 1, fetchImpl: async () => { n++; throw new Error('ECONNRESET'); } }), /ECONNRESET/);
  assert.equal(n, 3);
});
