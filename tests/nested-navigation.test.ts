import test from 'node:test';
import assert from 'node:assert/strict';
import { isNavItemActive, isNavItemCurrent, type DocsNavItem } from '../src/data/docs-nav';
import { accessPathForRequest } from '../src/lib/access';

test('deep descendants expand every ancestor, even when navigation and URL hierarchies differ', () => {
  const leaf: DocsNavItem = { title: 'Leaf', href: '/docsy/guides/platform/security/tokens/rotation' };
  let branch = leaf;
  for (let i = 0; i < 12; i++) branch = { title: `Group ${i}`, href: `/docsy/guides/group-${i}`, items: [branch] };
  let item = branch;
  while (item.items?.length) {
    assert.equal(isNavItemActive(item, `${leaf.href}/?view=full#example`), true);
    assert.equal(isNavItemCurrent(item, leaf.href), false);
    item = item.items[0];
  }
  assert.equal(isNavItemCurrent(leaf, `${leaf.href}/`), true);
});

test('navigation separates the current page from ancestors, anchors and similarly named paths', () => {
  const parent = { title: 'Platform', href: '/docsy/guides/platform/' };
  assert.equal(isNavItemActive(parent, '/docsy/guides/platform/security'), true);
  assert.equal(isNavItemCurrent(parent, '/docsy/guides/platform/security'), false);
  assert.equal(isNavItemActive(parent, '/docsy/guides/platform-other'), false);
  assert.equal(isNavItemActive({ title: 'Overview', href: '/docsy/' }, '/docsy/guides/platform'), false);
  const anchor = { title: 'Example', href: '/docsy/guides/platform#example' };
  assert.equal(isNavItemActive(anchor, '/docsy/guides/platform/'), true);
  assert.equal(isNavItemCurrent(anchor, '/docsy/guides/platform'), false);
});

test('Markdown export suffixes and URL encoding cannot change the canonical access target', () => {
  for (const path of ['/format-md/guides/private', '/format-md/guides/private.md', '/format-md/guides/private.md/', '/format-md/guides/%70rivate%2emd']) {
    assert.equal(accessPathForRequest(path), '/guides/private');
  }
  assert.equal(accessPathForRequest('/format-md/versions/v1/fr/index.md'), '/versions/v1/fr');
});
