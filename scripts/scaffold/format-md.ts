import type { APIRoute } from 'astro';
import { docsyConfig, isServer } from '../../config';
import { getDocuments } from '../../lib/documents';
import { findDocument } from '../../lib/agent-document';
import { generateMarkdown } from '../../lib/markdown-export';
export const prerender = !isServer;
export function getStaticPaths() { return getDocuments().map((document) => ({ params: { path: document.key } })); }
export const GET: APIRoute = async ({ params, locals }) => {
  const document = findDocument(params.path ?? 'index');
  const markdown = document ? await generateMarkdown(document.path, docsyConfig.site.origin, locals.docsyAccess?.tiers ?? []) : null;
  return new Response(markdown ?? '# Not found\n', { status: markdown === null ? 404 : 200, headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
};
