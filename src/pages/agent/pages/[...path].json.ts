import type { APIRoute } from 'astro';
import { docsyConfig, isServer } from '../../../config';
import { getDocuments } from '../../../lib/documents';
import { readAgentDocument, findDocument } from '../../../lib/agent-document';
import { canReadUrl, jsonResponse } from '../../../lib/agent-access';
export const prerender = !isServer;
export function getStaticPaths() { return docsyConfig.agent.enabled ? getDocuments().map((document) => ({ params: { path: document.key } })) : []; }
export const GET: APIRoute = async ({ params, locals }) => {
  const document = docsyConfig.agent.enabled ? findDocument(params.path ?? '') : undefined;
  if (!document || !canReadUrl(document.path, locals.docsyAccess?.tiers ?? [])) return jsonResponse({ error: 'not_found' }, 404);
  return jsonResponse(await readAgentDocument(document, locals.docsyAccess?.tiers ?? []));
};
