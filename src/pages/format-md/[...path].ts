import type { APIRoute } from 'astro';
import { docsyConfig, isServer } from '../../config';
import { getDocuments } from '../../lib/documents';
import { findDocument } from '../../lib/agent-document';
import { generateMarkdown } from '../../lib/markdown-export';
export const prerender = !isServer;
export function getStaticPaths() {
  const documents = getDocuments();
  return documents.flatMap(({ key }) => [
    { params: { path: `${key}.md` } },
    // Extensionless files cannot also be directories containing child exports.
    ...(!documents.some((document) => document.key.startsWith(`${key}/`)) ? [{ params: { path: key } }] : []),
  ]);
}
export const GET: APIRoute = async ({ params, locals }) => {
  const document = findDocument((params.path ?? 'index').replace(/\.md$/, ''));
  const markdown = document ? await generateMarkdown(document.path, docsyConfig.site.origin, locals.docsyAccess?.tiers ?? []) : null;
  return new Response(markdown ?? '# Not found\n', { status: markdown === null ? 404 : 200, headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
};
