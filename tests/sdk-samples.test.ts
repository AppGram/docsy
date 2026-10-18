// Legacy compact/converter regression tests. These hand-authored fixtures are
// explicitly NOT counted as native generator coverage; see native-imports.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { docsyConfig } from '../src/config';
import { loadSdk } from '../src/lib/sdk-loaders';
const source = (id: string) => ({ ...docsyConfig.ingestion.sdks[0], source: `sources/samples/${id === 'dart' ? 'dartdoc' : id}.json`, adapter: id === 'swift' ? 'swift-symbols' as const : 'dartdoc' as const });

test('Swift metadata preserves protocols, async method parameters, enum cases and examples', () => {
  const doc = loadSdk(source('swift'));
  const client = doc.categories.flatMap((category) => category.items).find((item) => item.name === 'AtlasClient')!;
  assert.ok(client.declaration?.includes('Sendable')); assert.match(client.example!, /getDocument/);
  const method = client.methods!.find((item) => item.name === 'getDocument(id:)')!;
  assert.equal(method.isAsync, true); assert.equal(method.returnType, 'Document'); assert.equal(method.parameters[0].type, 'String');
  assert.equal(method.parameters[0].description, 'Stable document identifier.');
  assert.ok(doc.categories.some((category) => category.title === 'Protocols'));
  assert.deepEqual(doc.categories.find((category) => category.title === 'Enums')!.items[0].values, ['draft', 'published', 'archived']);
});

test('AppGram/docc2json protocol requirements and Swift parameter semantics are retained', () => {
  const config = source('swift');
  const raw = JSON.parse(readFileSync(config.source, 'utf8'));
  assert.equal(raw.schemaVersion, '1.0.0'); assert.equal(raw.metadata.sdkName, 'AtlasSDK');
  assert.equal(raw.modules[0].protocols[0].requirements[0].kind, 'func');
  const doc = loadSdk(config);
  const requirement = doc.categories.find((category) => category.title === 'Protocols')!.items[0].methods![0];
  assert.equal(requirement.name, 'getDocument(id:)'); assert.equal(requirement.isAsync, true);
  assert.equal(requirement.returnType, 'Document'); assert.equal(requirement.parameters[0].type, 'String');

  const directory = mkdtempSync(join(tmpdir(), 'docsy-docc2json-'));
  try {
    raw.modules[0].types[0].methods[0].signature.parameters = [
      { name: 'nullable', type: 'String?', isOptional: true, description: 'Required argument with a nullable value.' },
      { name: 'limit', type: 'Int', isOptional: false, defaultValue: '20' },
    ];
    const path = join(directory, 'swift.json'); writeFileSync(path, JSON.stringify(raw));
    const method = loadSdk({ ...config, source: path }).categories[0].items[0].methods!.find((item) => item.name === 'getDocument(id:)')!;
    assert.equal(method.parameters[0].type, 'String?'); assert.equal(method.parameters[0].optional, undefined);
    assert.equal(method.parameters[1].optional, true);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('Dart index uses product-neutral class, enum and extension categories', () => {
  const doc = loadSdk(source('dart'));
  assert.deepEqual(doc.categories.map((category) => category.title), ['Classes', 'Enums', 'Extensions']);
  assert.equal(doc.itemCount, 4); assert.equal(doc.categories[0].items.length, 2);
});
