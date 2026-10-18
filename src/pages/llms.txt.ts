import type { APIRoute } from 'astro';
import { docsPath, docsyConfig, isServer } from '../config';
import { getDocuments } from '../lib/documents';
import { canReadUrl } from '../lib/agent-access';
import { readAgentDocument } from '../lib/agent-document';
export const prerender = !isServer;
export const GET: APIRoute = async ({ locals }) => {
  if (!docsyConfig.agent.enabled) return new Response('Not found', { status: 404 });
  const documents = await Promise.all(getDocuments().filter((document) => canReadUrl(document.path, locals.docsyAccess?.tiers ?? [])).map((document) => readAgentDocument(document, locals.docsyAccess?.tiers ?? [])));
  const text = `# ${docsyConfig.site.name}\n\n${docsyConfig.site.description}\n\nJSON index: ${new URL(docsPath('/agent/index.json'), docsyConfig.site.origin)}\n${docsyConfig.agent.query ? `Query: ${new URL(docsPath('/agent/query.json'), docsyConfig.site.origin)}?q=YOUR_QUERY\n` : ''}\n## Documentation\n\n${documents.map((document) => `- [${document.title.replace(/[\[\]\n]/g, '')}](${document.markdownUrl}) (${document.version}, ${document.locale})`).join('\n')}\n`;
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
};
