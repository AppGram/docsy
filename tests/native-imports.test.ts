import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { docsyConfig, docsPath } from '../src/config';
import { loadSdk, SDK_ADAPTERS } from '../src/lib/sdk-loaders';
import { NATIVE_LANGUAGE_FORMATS, SDK_FORMATS } from '../src/lib/sdk-formats';
import { generateMarkdown } from '../src/lib/markdown-export';
import { buildCorpus } from '../src/lib/corpus';
import { searchRecords } from '../src/lib/search';
import { sdkCoverage } from '../src/lib/sdk-coverage';

const provenance = JSON.parse(readFileSync('sources/native/provenance.json', 'utf8'));
const source = (language: string) => {
  const config = docsyConfig.ingestion.sdks.find((sdk) => sdk.language === language && sdk.adapter !== 'typedoc-lite');
  assert.ok(config, `Missing native ${language} configuration`); return config;
};

test('20 native languages have original generator output and matching source/output hashes', () => {
  assert.equal(Object.keys(NATIVE_LANGUAGE_FORMATS).length, 20);
  assert.deepEqual(provenance.fixtures.map((fixture: any) => fixture.language).sort(), Object.keys(NATIVE_LANGUAGE_FORMATS).sort());
  assert.deepEqual(Object.keys(SDK_ADAPTERS).sort(), [...SDK_FORMATS].sort());
  for (const fixture of provenance.fixtures) {
    assert.equal(fixture.adapter, NATIVE_LANGUAGE_FORMATS[fixture.language as keyof typeof NATIVE_LANGUAGE_FORMATS]);
    assert.ok(fixture.generator && fixture.version && fixture.commands.length && fixture.input.length && fixture.output.length);
    for (const file of [...fixture.input, ...fixture.output]) {
      const actual = createHash('sha256').update(readFileSync(file.path)).digest('hex');
      assert.equal(actual, file.sha256, `Stale/tampered generator fixture: ${file.path}; run npm run fixtures:generate`);
    }
    assert.ok(fixture.input.some((file: any) => /\.(?:ts|js|py|java|kt|scala|cs|fs|vb|h|hpp|go|rs|swift|dart|php|rb|ex|lua)$/.test(file.path)), `No real source for ${fixture.language}`);
  }
});

for (const language of Object.keys(NATIVE_LANGUAGE_FORMATS)) test(`${language}: imports real declarations, documented methods, typed parameters and returns`, () => {
  const config = source(language), doc = loadSdk(config);
  const items = doc.categories.flatMap((category) => category.items);
  assert.ok(doc.itemCount > 0); assert.equal(doc.itemCount, items.length);
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  const greet = items.find((item) => /(?:^|[.#:])greet(?:\(|:|$)/i.test(item.name) && item.parameters?.some((parameter) => parameter.name === 'name'));
  assert.ok(greet, `No greet(name) method imported for ${language}`);
  assert.ok(greet.declaration?.toLowerCase().includes('greet'), `Missing native signature for ${language}`);
  assert.ok(greet.summary?.toLowerCase().includes('greet'), `Missing native description for ${language}`);
  assert.ok(greet.returnType && greet.returnType !== 'unknown', `Missing return type for ${language}`);
  assert.ok(greet.parameters!.every((parameter) => parameter.type && parameter.type !== 'unknown'), `Missing native parameter type for ${language}`);
});

for (const language of Object.keys(NATIVE_LANGUAGE_FORMATS)) test(`${language}: richer native examples, batch operations and local language logo`, () => {
  const config = source(language), doc = loadSdk(config);
  const items = doc.categories.flatMap((category) => category.items);
  assert.ok(items.some((item) => /greet[_]?many/i.test(item.name)), `Missing native batch API for ${language}`);
  const examples = items.filter((item) => item.example);
  assert.ok(examples.length >= 2, `Expected multiple native examples for ${language}`);
  assert.ok(examples.some((item) => /Ada|Linus/.test(item.example!)));
  assert.ok(examples.some((item) => /Docsy/.test(item.example!)));
  assert.equal(sdkCoverage(doc).find((entry) => entry.label === 'examples')?.count, examples.length);
  assert.equal(config.icon, `assets/sdks/${language}.svg`);
  const svg = readFileSync(`public/${config.icon}`, 'utf8');
  assert.match(svg, /<svg/); assert.doesNotMatch(svg, /<script|<foreignObject|(?:href|src)=["'](?:https?:|\/\/|data:)/i);
  if (config.iconDark) assert.match(readFileSync(`public/${config.iconDark}`, 'utf8'), /<svg/);
});

test('rich native details retain exact code, defaults, errors, enums and example language', () => {
  const items = (language: string) => loadSdk(source(language)).categories.flatMap((category) => category.items);
  for (const language of ['typescript', 'javascript', 'python', 'rust', 'csharp', 'fsharp', 'visualbasic', 'kotlin', 'java', 'scala', 'cpp', 'php', 'ruby']) assert.ok(items(language).some((item) => item.throws?.length), `Missing native errors for ${language}`);
  for (const language of ['typescript', 'swift', 'dart', 'rust', 'csharp', 'java', 'kotlin', 'c']) assert.ok(items(language).some((item) => item.values?.length), `Missing native enum values for ${language}`);
  assert.equal(items('rust').find((item) => item.name === 'Greeter')!.properties![0].name, 'prefix');
  assert.equal(items('ruby').find((item) => item.name === 'prefix')!.kind, 'property');
  assert.equal(items('lua').find((item) => item.name === 'greet')!.summary, 'Greet a reader.');
  assert.ok(items('lua').find((item) => item.name === 'greet_checked')!.throws?.length);
  for (const language of ['typescript', 'javascript', 'python', 'scala', 'dart', 'ruby', 'php']) assert.ok(items(language).some((item) => item.parameters?.some((parameter) => parameter.optional)), `Missing optional/default parameter for ${language}`);
  assert.equal(items('python').find((item) => item.name === 'greeter.Greeter.greet')!.example, "Greeter().greet('Docsy')");
  assert.equal(items('kotlin').find((item) => item.name === 'Greeter')!.example, 'val greeter = Greeter()\nprintln(greeter.greet("Docsy"))');
  assert.equal(items('c').find((item) => item.name === 'greet')!.example, 'const char *message = greet("Docsy");');
  assert.equal(items('rust').find((item) => item.name === 'greet')!.example, 'let greeting = greeter::Greeter::greet("Docsy");');
  assert.equal(items('fsharp').find((item) => item.example)!.exampleLanguage, 'fsharp');
  assert.deepEqual(items('dart').find((item) => item.name === 'greetMany')!.parameters!.map((parameter) => [parameter.name, parameter.type, parameter.optional]), [['names', 'List<String>', false], ['separator', 'String', true]]);
});

test('native TypeDoc imports nested members, examples, properties and enum values', () => {
  const items = loadSdk(source('typescript')).categories.flatMap((category) => category.items);
  assert.ok(items.find((item) => item.name === 'Greeter')!.methods?.some((method) => method.name === 'greet'));
  assert.ok(items.find((item) => item.name === 'Greeter')!.properties?.some((property) => property.name === 'prefix'));
  assert.match(items.find((item) => item.name === 'Greeter.greet')!.example!, /Docsy/);
  assert.deepEqual(items.find((item) => item.name === 'Mood')!.values!.sort(), ['Formal', 'Friendly']);
});

test('DocFX uses VB syntax and labels F# assembly fallback declarations accurately', () => {
  const vb = loadSdk(source('visualbasic')).categories.flatMap((category) => category.items).find((item) => item.parameters?.length)!;
  assert.match(vb.declaration!, /Function Greet/); assert.equal(vb.language, 'vbnet');
  const fs = loadSdk(source('fsharp')).categories.flatMap((category) => category.items).find((item) => item.parameters?.length)!;
  assert.match(fs.declaration!, /public string Greet/); assert.equal(fs.language, 'csharp');
});

test('native IDs are stable when artifact directories move', () => {
  const directory = mkdtempSync(join(tmpdir(), 'docsy-native-move-'));
  try {
    for (const language of ['java', 'kotlin', 'scala', 'rust', 'ruby', 'lua', 'elixir', 'dart']) {
      const config = source(language), copied = join(directory, language); cpSync(config.source, copied, { recursive: true });
      const ids = (sourcePath: string) => loadSdk({ ...config, source: sourcePath }).categories.flatMap((category) => category.items.map((item) => item.id)).sort();
      assert.deepEqual(ids(config.source), ids(copied), language);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('native import bounds, format errors, XML entities and symlinks fail closed', () => {
  const directory = mkdtempSync(join(tmpdir(), 'docsy-native-safety-'));
  try {
    assert.throws(() => loadSdk({ ...source('java'), maxFileBytes: 10 }), /maxFileBytes/);
    assert.throws(() => loadSdk({ ...source('java'), maxFiles: 1 }), /maxFiles/);
    const bad = join(directory, 'bad.xml');
    writeFileSync(bad, '<!DOCTYPE project [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><project>&xxe;</project>');
    assert.throws(() => loadSdk({ ...source('php'), source: bad }), /entities|declarations/);
    writeFileSync(bad, '<project><broken></project>');
    assert.throws(() => loadSdk({ ...source('php'), source: bad }), /Invalid native XML/);
    const link = join(directory, 'link'); symlinkSync(join(process.cwd(), source('java').source), link);
    assert.throws(() => loadSdk({ ...source('java'), source: link }), /symlink/);
    const empty = join(directory, 'empty.html'); writeFileSync(empty, '<script>throw new Error("must never execute")</script><p>No symbols.</p>');
    assert.throws(() => loadSdk({ ...source('java'), source: empty }), /No supported API symbols/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('all 20 native references reach Markdown, search and non-default locales', async () => {
  for (const language of Object.keys(NATIVE_LANGUAGE_FORMATS)) {
    const config = source(language);
    const markdown = await generateMarkdown(docsPath(`/${config.slug}`), docsyConfig.site.origin);
    assert.match(markdown!, /greet/i); assert.match(markdown!, /name/);
  }
  const corpus = await buildCorpus();
  const results = searchRecords(corpus, 'greet', { version: 'current', locale: 'es', type: 'sdk', limit: 50 });
  assert.ok(results.length); assert.ok(results.every((result) => result.locale === 'es' && result.url.includes('/versions/current/es/')));
});
