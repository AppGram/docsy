import type { APIRoute } from 'astro';
import { docsyConfig, isServer } from '../config';
import { getDocuments } from '../lib/documents';
import { canReadUrl } from '../lib/agent-access';
import { readAgentDocument } from '../lib/agent-document';
export const prerender = !isServer;
export const GET: APIRoute = async ({ locals }) => {
  if (!docsyConfig.agent.enabled) return new Response('Not found', { status: 404 });
  const docs = await Promise.all(getDocuments().filter((document) => canReadUrl(document.path, locals.docsyAccess?.tiers ?? [])).map((document) => readAgentDocument(document, locals.docsyAccess?.tiers ?? [])));
  return new Response(docs.map((document) => `<!-- ${document.url} | ${document.version} | ${document.locale} -->\n${document.markdown}`).join('\n\n---\n\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
};
