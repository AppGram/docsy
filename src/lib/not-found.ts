import { docsPath, type DocsContext } from '../config';
import { getDocuments } from './documents';

// A recovery link should still work when fallback:false omits an untranslated
// article from the current context. Keep external URLs untouched.
export function notFoundHref(href: string, context: DocsContext): string {
  if (/^https?:\/\//i.test(href)) return href;
  const candidate = docsPath(href, context);
  const path = new URL(candidate, 'https://docsy.invalid').pathname.replace(/\/+$/, '') || '/';
  return getDocuments().some((document) => (document.path.replace(/\/+$/, '') || '/') === path)
    ? candidate
    : docsPath(href);
}
