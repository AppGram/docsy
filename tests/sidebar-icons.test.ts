import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { icons as lucide } from '@iconify-json/lucide';
import { icons as tabler } from '@iconify-json/tabler';
import { resolveSidebarIcon, sidebarIconSchema } from '../src/lib/sidebar-icons';
import { assetPath, docsyConfig } from '../src/config';
import { getDocsNav } from '../src/data/docs-nav';

test('every bundled Lucide/Tabler icon and alias resolves without an icon service', () => {
  for (const pack of [lucide, tabler]) {
    for (const name of [...Object.keys(pack.icons), ...Object.keys(pack.aliases ?? {})]) {
      const reference = `${pack.prefix}:${name}`;
      assert.ok(sidebarIconSchema.safeParse(reference).success, reference);
    }
    const name = Object.keys(pack.icons)[0];
    const icon = resolveSidebarIcon(`${pack.prefix}:${name}`, assetPath)!;
    assert.equal(icon.mode, 'mask'); assert.equal(icon.reference, `${pack.prefix}:${name}`);
    assert.match(icon.src, /^data:image\/svg\+xml,/);
    const svg = decodeURIComponent(icon.src.slice(icon.src.indexOf(',') + 1));
    assert.match(svg, /<svg/); assert.match(svg, /viewBox=/);
    assert.doesNotMatch(svg, /<script|<foreignObject|@font-face|https?:\/\/(?!www\.w3\.org)/i);
    assert.deepEqual(resolveSidebarIcon({ pack: pack.prefix as 'lucide' | 'tabler', name }, assetPath), icon);
  }
});
test('custom icons preserve legacy paths, dark variants, theme masks and optional text-only rows', () => {
  assert.deepEqual(resolveSidebarIcon('assets/sdks/swift.svg', assetPath), { src: '/docsy/assets/sdks/swift.svg', mode: 'image' });
  assert.deepEqual(resolveSidebarIcon({ src: 'assets/light.svg', darkSrc: 'assets/dark.svg' }, assetPath), { src: '/docsy/assets/light.svg', darkSrc: '/docsy/assets/dark.svg', mode: 'image' });
  assert.equal(resolveSidebarIcon({ src: 'assets/mark.svg', mode: 'mask' }, assetPath)?.mode, 'mask');
  assert.equal(resolveSidebarIcon(false, assetPath), undefined); assert.equal(resolveSidebarIcon(undefined, assetPath), undefined);
  assert.equal(resolveSidebarIcon('https://example.test/icon.svg', assetPath)?.src, 'https://example.test/icon.svg');
});
test('sidebar icons reject unknown packs/names, executable resources, traversal and raw markup', () => {
  for (const value of ['lucide:made-up-docsy-icon', 'unknown:book', 'javascript:alert(1)', 'data:image/svg+xml,<svg/>', '//evil.test/a.svg', '/%2fexample.test/a.svg', '../secret.svg', '/%2e%2e/private.svg', 'assets/mark.svg";color:red', '<svg/>', 'assets/a\n.svg', 'file:///private/a.svg', { pack: 'lucide', name: 'missing-docsy-icon' }, { src: 'javascript:alert(1)' }, { src: 'assets/a.svg', darkSrc: '//evil.test/a.svg' }, { src: 'assets/a.svg', mode: 'script' }, { src: 'assets/a.svg', onclick: 'bad()' }]) {
    assert.equal(sidebarIconSchema.safeParse(value).success, false, JSON.stringify(value));
  }
});
test('navigation retains pack/custom icons across language contexts without changing hrefs', () => {
  for (const locale of ['en', 'es', 'fr']) {
    const nav = getDocsNav({ version: 'current', locale });
    const start = nav.flatMap((section) => section.items).find((item) => item.icon?.reference === 'lucide:book-open');
    assert.ok(start); assert.ok(start.href.includes('/guides/getting-started'));
    const rust = nav.flatMap((section) => section.items).find((item) => item.href.endsWith('/rust-sdk'));
    assert.equal(rust?.icon?.src, '/docsy/assets/sdks/rust.svg');
    assert.equal(rust?.icon?.darkSrc, '/docsy/assets/sdks/rust-dark.svg');
  }
  assert.equal(docsyConfig.sidebar.iconSize, 16);
});
test('sidebar component renders inert masks/images and inherits currentColor without hosted fonts', () => {
  const component = readFileSync('src/components/docs/SidebarIcon.astro', 'utf8');
  assert.match(component, /background: currentColor/); assert.match(component, /mask:/);
  assert.match(component, /aria-hidden="true"/); assert.match(component, /data-theme="dark"/);
  assert.doesNotMatch(component, /set:html|<script|@font-face|@import|https?:\/\//);
});
