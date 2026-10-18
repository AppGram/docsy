import { docsyConfig } from '../config';
import { accessPathForRequest, canAccessPath, relativeDocsPath } from './access';
export function canReadUrl(url: string, tiers: string[]) {
  const path = new URL(url, docsyConfig.site.origin).pathname;
  const relative = relativeDocsPath(path);
  return relative !== null && canAccessPath(accessPathForRequest(relative), tiers);
}
export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
}
