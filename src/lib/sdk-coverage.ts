import type { SDKDoc } from './sdk-loaders';

// Report what was actually imported, not a language-wide capability promise.
export function sdkCoverage(doc: SDKDoc) {
  const items = doc.categories.flatMap((category) => category.items);
  return [
    { label: 'examples', singular: 'example', items: items.filter((item) => item.example), suffix: '-example' },
    { label: 'error contracts', singular: 'error contract', items: items.filter((item) => item.throws?.length), suffix: '' },
    { label: 'properties', singular: 'property', items: items.filter((item) => item.kind === 'property' || item.properties?.length), suffix: '' },
    { label: 'enums', singular: 'enum', items: items.filter((item) => item.kind === 'enum'), suffix: '' },
    { label: 'deprecated symbols', singular: 'deprecated symbol', items: items.filter((item) => item.deprecated), suffix: '' },
  ].filter((entry) => entry.items.length).map((entry) => ({ label: entry.items.length === 1 ? entry.singular : entry.label, count: entry.items.length, href: `#${entry.items[0].id}${entry.suffix}` }));
}
