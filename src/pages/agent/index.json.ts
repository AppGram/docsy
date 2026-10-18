import type { APIRoute } from 'astro';
import { docsyConfig, docsPath, isServer } from '../../config';
import { buildCorpus } from '../../lib/corpus';
import { canReadUrl, jsonResponse } from '../../lib/agent-access';
export const prerender = !isServer;
export const GET: APIRoute = async ({ locals }) => {
  if (!docsyConfig.agent.enabled) return jsonResponse({ error: 'agent_disabled' }, 404);
  return jsonResponse({
    schemaVersion: 1, mode: docsyConfig.agent.query ? 'server' : 'static',
    queryEndpoint: docsyConfig.agent.query ? docsPath('/agent/query.json') : null,
    entries: (await buildCorpus()).filter((entry) => canReadUrl(entry.url, locals.docsyAccess?.tiers ?? [])),
  });
};
