// Optional real-runtime smoke test, not a static-string assertion.
// The normal unit suite remains offline and verifies all 24 generators.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { generateRequestExamples } from '../src/lib/request-examples.ts';

const exec = promisify(execFile), directory = mkdtempSync(join(tmpdir(), 'docsy-live-requests-'));
const payload = { title: "reader's \"guide\"", body: 'line 1\nline 2 $name #{unsafe}', userId: 1 };
const headerValue = "native's \"quotes\" $name #{unsafe}";
const received = [];
const errors = [];
const server = createServer(async (request, response) => {
  try {
  let body = ''; for await (const chunk of request) body += chunk;
  const parsed = JSON.parse(body); assert.deepEqual(parsed, payload); assert.equal(request.method, 'POST'); assert.equal(request.headers['x-docsy-test'], headerValue); assert.equal(request.headers['content-type'].split(';')[0], 'application/json');
  received.push(request.url); response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ ok: true }));
  } catch (error) { errors.push(error.message); response.statusCode = 422; response.end(JSON.stringify({ error: error.message })); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const port = server.address().port;
const run = async (command, args, options = {}) => exec(command, args, { cwd: directory, timeout: 120000, maxBuffer: 2 * 1024 * 1024, ...options });
const source = (language, container = false) => generateRequestExamples({ method: 'POST', url: `http://${container ? 'host.docker.internal' : '127.0.0.1'}:${port}/echo/${language}`, headers: [{ name: 'Content-Type', value: 'application/json' }, { name: 'X-Docsy-Test', value: headerValue }], body: JSON.stringify(payload), mimeType: 'application/json' }, [language], '')[0].code;
const file = (name, code) => { const path = join(directory, name); writeFileSync(path, code); return path; };
const checked = [];
const check = async (language, action) => { const count = received.length; await action(); assert.equal(received.length, count + 1, `${language} never made a correct request: ${errors.at(-1) || ''}`); checked.push(language); console.log(`PASS live ${language}`); };
const javaHome = process.env.DOCSY_JAVA_HOME || '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
const java = join(javaHome, 'bin/java');
const ruby = process.env.DOCSY_RUBY || '/opt/homebrew/opt/ruby/bin/ruby';
const python = resolve('.docsy/generators/python/bin/python');

try {
  await check('javascript', () => run(process.execPath, [file('javascript.mjs', source('javascript'))]));
  await check('node', () => run(process.execPath, [file('node.mjs', source('node'))]));
  await check('python', () => run(python, [file('python.py', source('python'))]));
  await check('go', () => run('go', ['run', file('go.go', source('go'))], { env: { ...process.env, GOCACHE: resolve('.docsy/generators/go-cache') } }));
  await check('java', () => run(java, [file('Example.java', `import java.net.URI;\nimport java.net.http.*;\npublic class Example { public static void main(String[] args) throws Exception {\n${source('java')}\n}}`)]));
  await check('ruby', () => run(ruby, [file('ruby.rb', source('ruby'))]));
  await check('swift', () => run('swift', [file('swift.swift', source('swift'))], { env: { ...process.env, CLANG_MODULE_CACHE_PATH: resolve('.docsy/generators/swift-module-cache'), SWIFT_MODULECACHE_PATH: resolve('.docsy/generators/swift-module-cache') } }));
  const wrapCurl = (code) => `#include <stdio.h>\n#include <curl/curl.h>\nint main(void) {\n${code}\ncurl_slist_free_all(headers);\ncurl_easy_cleanup(hnd);\nreturn (int)ret;\n}`;
  await check('c', async () => { await run('cc', [file('c.c', wrapCurl(source('c'))), '-lcurl', '-o', join(directory, 'c-request')]); await run(join(directory, 'c-request'), []); });
  await check('cpp', async () => { await run('c++', [file('cpp.cpp', wrapCurl(source('cpp'))), '-lcurl', '-o', join(directory, 'cpp-request')]); await run(join(directory, 'cpp-request'), []); });
  await check('scala', async () => {
    const jars = ['scala-library-2.13.16.jar', 'scala-reflect-2.13.16.jar', 'scala-compiler-2.13.16.jar'].map((name) => resolve('.docsy/generators', name));
    await run(java, ['-Dscala.usejavacp=true', '-cp', jars.join(':'), 'scala.tools.nsc.Main', '-d', directory, file('scala.scala', source('scala'))]);
    await run(java, ['-cp', `${directory}:${jars[0]}`, 'Example']);
  });
  const dockerRun = (script) => run('docker', ['run', '--rm', '-v', `${directory}:/requests`, '-w', '/requests', 'docsy-generators:local', 'sh', '-ec', script]);
  await check('elixir', async () => { file('elixir.exs', source('elixir', true)); await dockerRun('elixir elixir.exs'); });
  for (const [language, ext] of [['csharp', 'cs'], ['fsharp', 'fs'], ['visualbasic', 'vb']]) await check(language, async () => {
    const folder = join(directory, language); mkdirSync(folder);
    writeFileSync(join(folder, `Example.${ext}proj`), `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework><OutputType>Exe</OutputType><ImplicitUsings>enable</ImplicitUsings></PropertyGroup>${language === 'fsharp' ? '<ItemGroup><Compile Include="Program.fs" /></ItemGroup>' : ''}</Project>`);
    writeFileSync(join(folder, `Program.${ext}`), source(language, true));
    await dockerRun(`dotnet run --project ${language}/Example.${ext}proj -v quiet`);
  });
  console.log(`Executed ${checked.length} generated request programs against the local echo server.`);
} finally { server.close(); rmSync(directory, { recursive: true, force: true }); }
