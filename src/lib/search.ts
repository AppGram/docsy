import type { ArticleAuthorship } from './authorship';
export type SearchRecord = {
  id: string; type: 'page' | 'api' | 'sdk'; title: string; url: string; group: string;
  body: string; summary?: string; kind?: string; method?: string; path?: string;
  version: string; locale: string; markdownUrl: string; jsonUrl: string;
  contentLocale?: string; isFallback?: boolean;
  authorship?: ArticleAuthorship;
};
export type SearchFilters = { version?: string; locale?: string; type?: string; limit?: number };
const normalize = (value: string) => value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase();
export function searchRecords(records: SearchRecord[], query: string, filters: SearchFilters = {}) {
  const words = (value: string) => normalize(value).match(/[\p{L}\p{N}_]+/gu) ?? [];
  const terms = [...new Set(words(query))].slice(0, 30);
  if (!terms.length) return [];
  const phrase = normalize(query.trim());
  return records.filter((record) => (!filters.version || record.version === filters.version) && (!filters.locale || record.locale === filters.locale) && (!filters.type || record.type === filters.type)).flatMap((record) => {
    const title = normalize(record.title), group = normalize(record.group), body = normalize(record.body), path = normalize(record.path ?? '');
    const titleWords = words(title), groupWords = words(group), pathWords = words(path), bodyWords = words(body);
    const contains = (tokens: string[], term: string, index: number) => tokens.some((word) => word === term || (index === terms.length - 1 && term.length >= 3 && word.startsWith(term)));
    if (!terms.every((term, index) => contains([...titleWords, ...groupWords, ...pathWords, ...bodyWords], term, index))) return [];
    let score = title === phrase ? 100 : title.includes(phrase) ? 40 : 0;
    for (const [index, term] of terms.entries()) score += (contains(titleWords, term, index) ? 16 : 0) + (contains(groupWords, term, index) ? 6 : 0) + (contains(pathWords, term, index) ? 8 : 0) + (contains(bodyWords, term, index) ? 2 : 0);
    if (body.includes(phrase)) score += 12;
    const positions = terms.map((term) => new RegExp(`(?<![\\p{L}\\p{N}_])${term}`, 'u').exec(body)?.index).filter((index): index is number => index !== undefined);
    const first = body.includes(phrase) ? body.indexOf(phrase) : Math.min(...positions);
    const start = Number.isFinite(first) ? Math.max(0, first - 35) : 0;
    const excerpt = `${start ? '…' : ''}${record.body.slice(start, start + 240)}${record.body.length > start + 240 ? '…' : ''}`;
    return [{ ...record, score, excerpt }];
  }).sort((a, b) => b.score - a.score || a.url.localeCompare(b.url)).slice(0, Math.max(1, Math.min(50, filters.limit ?? 30)));
}
