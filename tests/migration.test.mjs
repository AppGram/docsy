import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { load } from 'js-yaml';
import { convertMintlifyMarkdown, migrateMintlify } from '../scripts/migrate-mintlify.mjs';
const temporary = [];
const temp = () => { const root = mkdtempSync(join(tmpdir(), 'docsy-migration-')); temporary.push(root); return root; };
afterEach(() => { for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true }); });
const write = (root, path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
const fixture = () => {
  const source = temp(); const output = join(temp(), 'site');
  write(source, 'docs.json', JSON.stringify({ name: 'Example docs', navigation: { groups: [{ group: 'Start', pages: ['intro', { group: 'Deep', pages: ['guides/install'] }] }] }, redirects: [{ source: '/old-start', destination: '/intro' }] }));
  write(source, 'intro.mdx', '---\ntitle: Hello\ndescription: Start here\n---\n\n<Note title="Keep it local">\nConfiguration lives in YAML.\n</Note>\n\n[Install](/guides/install#setup)\n\n![Diagram](/images/chart.svg)\n');
  write(source, 'guides/install.md', '# Install\n\n## Setup\n\n[Start](../intro)\n');
  write(source, 'images/chart.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>');
  return { source, output };
};
test('Mintlify migration preserves selected navigation, images, links and old routes', () => {
  const { source, output } = fixture();
  const result = migrateMintlify(source, output);
  const config = load(readFileSync(join(output, 'docsy.config.yaml'), 'utf8'));
  assert.equal(result.pages.length, 2); assert.equal(result.assets.length, 1);
  assert.equal(config.content.articles[0].title, 'Hello');
  assert.equal(config.navigation[0].items[1].items[0].href, '/guides/guides/install');
  assert.equal(config.redirects['/old-start'], '/guides/intro');
  assert.equal(config.redirects['/guides/install'], '/guides/guides/install');
  const body = readFileSync(join(output, 'content/migrated/intro.mdx'), 'utf8');
  assert.match(body, /<Note title="Keep it local">/);
  assert.equal(config.content.mdx.allowJavaScript, false);
  assert.match(body, /\/guides\/guides\/install#setup/);
  assert.match(body, /\/assets\/migrated\/images\/chart.svg/);
  assert.equal(result.published, false);
  assert.match(readFileSync(join(source, 'intro.mdx'), 'utf8'), /<Note/);
});
test('unsupported MDX is blocked before writing a partial destination', () => {
  const { source, output } = fixture();
  write(source, 'intro.mdx', 'import Secret from "./secret"\n\n<Secret />');
  assert.throws(() => migrateMintlify(source, output), /Unsupported MDX/);
  assert.ok(!existsSync(output));
  assert.throws(() => convertMintlifyMarkdown('<Note>\n<Warning>\nNo\n</Warning>\n</Note>', 'nested'), /nested/);
});
test('migration refuses symlinks, missing links and existing output directories', () => {
  const { source, output } = fixture(); const external = temp();
  write(external, 'page.md', 'private');
  rmSync(join(source, 'intro.mdx')); symlinkSync(join(external, 'page.md'), join(source, 'intro.mdx'));
  assert.throws(() => migrateMintlify(source, output), /symlink/);
  rmSync(join(source, 'intro.mdx')); write(source, 'intro.mdx', '[Missing](/unregistered)');
  assert.throws(() => migrateMintlify(source, output), /not in the selected navigation/);
  mkdirSync(output); assert.throws(() => migrateMintlify(source, output), /never overwritten/);
});
test('multi-version navigation is not silently flattened', () => {
  const { source, output } = fixture();
  write(source, 'docs.json', JSON.stringify({ navigation: { versions: [{ version: 'v1' }] } }));
  assert.throws(() => migrateMintlify(source, output), /one version\/locale/);
});
test('migration leaves code examples unchanged, including inline generic types and fake links', () => {
  const { source, output } = fixture();
  const example = '`Array<T>` and `[example](/not-a-page)`\n\n```md\n[example](/not-a-page)\n<Card />\n```';
  write(source, 'intro.mdx', `${example}\n\n[Install](/guides/install)`);
  migrateMintlify(source, output);
  assert.ok(readFileSync(join(output, 'content/migrated/intro.mdx'), 'utf8').includes(example));
});
test('malformed frontmatter and output inside the source fail before generation', () => {
  const { source, output } = fixture();
  assert.throws(() => migrateMintlify(source, join(source, '..nested')), /outside/);
  write(source, 'intro.mdx', '---\ntitle: [Not, text]\n---\nHello');
  assert.throws(() => migrateMintlify(source, output), /title must be text/);
  write(source, 'intro.mdx', '---\nredirects: /old-page\n---\nHello');
  assert.throws(() => migrateMintlify(source, output), /redirects must be an array/);
  assert.ok(!existsSync(output));
});
test('simple Cards and Steps convert without changing code and upstream notices are preserved', () => {
  const { source, output } = fixture();
  write(source, 'LICENSE', 'Upstream license notice');
  write(source, 'intro.mdx', '<Card title="Install" icon="rocket" href="/guides/install">\nRead this guide.\n</Card>\n\n<Steps>\n  <Step title="Install">\n    Run this:\n\n    ```sh\n    npm install example\n    ```\n  </Step>\n</Steps>');
  const report = migrateMintlify(source, output, { format: 'markdown' });
  const body = readFileSync(join(output, 'content/migrated/intro.md'), 'utf8');
  assert.match(body, /### \[Install\]\(\/guides\/guides\/install\)/);
  assert.match(body, /:::steps\n\n1\. \*\*Install\*\*/);
  assert.match(body, /   ```sh\n   npm install example\n   ```/);
  assert.equal(readFileSync(join(output, 'migration/upstream/LICENSE'), 'utf8'), 'Upstream license notice');
  assert.equal(report.notices.length, 1);
});
test('linked images rewrite asset and destination together without overlapping edits', () => {
  const { source, output } = fixture();
  write(source, 'intro.mdx', '[![Chart](/images/chart.svg)](/guides/install)\n\nKeep this sentence.');
  migrateMintlify(source, output);
  assert.equal(readFileSync(join(output, 'content/migrated/intro.mdx'), 'utf8'), '[![Chart](/assets/migrated/images/chart.svg)](/guides/guides/install)\n\nKeep this sentence.');
});
test('native MDX migration retains tabs and cards, rewrites JSX links/assets and reference definitions', () => {
  const { source, output } = fixture();
  const code = '```mdx\n<Card href="/not-a-page" />\n```';
  write(source, 'intro.mdx', `<Tabs>\n<Tab title="Read">\n<Card title="Install" href="/guides/install">\n<img src="/images/chart.svg" alt="Diagram" />\n\n[Nested reference][install]\n</Card>\n</Tab>\n</Tabs>\n\n[install]: /guides/install#setup\n\n${code}`);
  const report = migrateMintlify(source, output);
  const body = readFileSync(join(output, 'content/migrated/intro.mdx'), 'utf8');
  assert.match(body, /<Tabs>/); assert.match(body, /href="\/guides\/guides\/install"/);
  assert.match(body, /src="\/assets\/migrated\/images\/chart.svg"/);
  assert.match(body, /\[install\]: \/guides\/guides\/install#setup/);
  assert.ok(body.includes(code)); assert.equal(report.format, 'mdx');
});
test('migration refuses executable MDX props without opting in or creating destination', () => {
  const { source, output } = fixture();
  write(source, 'intro.mdx', '<Card title={process.env.SECRET} href="/guides/install" />');
  assert.throws(() => migrateMintlify(source, output), /requires a literal/);
  assert.ok(!existsSync(output));
});
