import type { APIRoute } from 'astro';
import { docsyConfig, isServer } from '../config';
import { buildCorpus } from '../lib/corpus';
import { canReadUrl } from '../lib/agent-access';
export const prerender = !isServer;
export const GET: APIRoute = async ({ locals }) => {
  const entries = docsyConfig.search.enabled ? (await buildCorpus()).filter((entry) => canReadUrl(entry.url, locals.docsyAccess?.tiers ?? [])) : [];
  return new Response(JSON.stringify({ schemaVersion: 1, entries, count: entries.length }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
};
