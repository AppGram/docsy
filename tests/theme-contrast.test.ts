import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { docsyConfig } from '../src/config';

const layout = readFileSync('src/layouts/DocsLayout.astro', 'utf8');
const sdk = readFileSync('src/components/docs/SDKPageBody.astro', 'utf8');
const dark = readFileSync('src/styles/docsy-dark.css', 'utf8');
const media = readFileSync('src/styles/media-viewer.css', 'utf8');
const rule = (source: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const result = source.replace(/\s+/g, ' ').match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  assert.ok(result, `Missing rule: ${selector}`); return result[1];
};
const luminance = (hex: string) => {
  const value = hex.replace('#', '');
  assert.match(value, /^[a-f\d]{6}$/i);
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
};

test('shared reference prose, lists and inline code follow theme tokens, not light-only colors', () => {
  for (const selector of ['.docs-content p', '.docs-content ul, .docs-content ol', '.docs-content code']) {
    assert.match(rule(layout, selector), /color:\s*var\(--ink\)/);
    assert.doesNotMatch(rule(layout, selector), /color:\s*#/);
  }
  assert.match(rule(layout, '.docs-content code'), /background:.*var\(--paper\).*var\(--ink\)/);
  assert.match(rule(layout, '.docs-content hr'), /var\(--line\)/);
});

test('SDK status, empty states and badges also respect the active theme', () => {
  assert.match(rule(sdk, '.ai-border-glow'), /background:\s*var\(--paper\)/);
  assert.match(rule(sdk, '.sdk-empty'), /background:.*var\(--paper\)/);
  assert.match(rule(sdk, '.sdk-detail-default code'), /background:.*var\(--paper\)/);
  assert.match(rule(dark, 'html[data-theme="dark"] .sdk-deprecated, html[data-theme="dark"] .sdk-deprecated strong'), /color:\s*var\(--ink\)/);
});
test('media viewer hover controls use a contrasting paper/ink mix, not the dark code panel', () => {
  const hover = rule(media, '.docs-media-viewer button:hover:not(:disabled), .docs-media-viewer a:hover');
  assert.match(hover, /background:\s*color-mix\(in srgb, var\(--ink\) 8%, var\(--paper\)\)/);
  assert.match(hover, /color:\s*var\(--ink\)/); assert.doesNotMatch(hover, /var\(--panel\)/);
});

test('portal primary and secondary prose colors have readable contrast in both palettes', () => {
  const { mode, colors, lightColors, darkColors } = docsyConfig.theme;
  for (const palette of [mode === 'light' ? colors : lightColors, mode === 'dark' ? colors : darkColors]) {
    for (const text of [palette.ink, palette.muted]) {
      const [bright, dim] = [luminance(text), luminance(palette.paper)].sort((a, b) => b - a);
      assert.ok((bright + 0.05) / (dim + 0.05) >= 4.5, `${text} on ${palette.paper}`);
    }
  }
});
