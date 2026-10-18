import { docsyConfig, type DocsContext } from '../config';
export const english = {
  guides: 'Guides', apiReference: 'API reference', onThisPage: 'On this page',
  version: 'Version', language: 'Language', previous: 'Previous', next: 'Next',
  searchHint: 'Start typing to search.', searchLoading: 'Loading index…', searchEmpty: 'No results',
  searchNavigate: 'to navigate', searchSelect: 'to select', searchClose: 'to close', page: 'Page',
  fallback: 'This page is shown in the default language because a translation is not available.',
  deprecated: 'You are reading an older, deprecated documentation version.', beta: 'This documentation version is in beta.',
  request: 'Request', response: 'Response', pathParameters: 'Path parameters', queryParameters: 'Query parameters',
  headerParameters: 'Header parameters', authorization: 'Authorizations', required: 'required',
};
export function message(context: DocsContext, key: string, fallback?: string): string {
  return docsyConfig.localization?.messages[context.locale]?.[key] ?? fallback ?? english[key as keyof typeof english] ?? key;
}
