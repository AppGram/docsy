import { defineMiddleware } from 'astro:middleware';
import { defaultContext, docsPath, docsyConfig, isServer, parseDocsPath } from './config';
import {
  accessPathForRequest,
  evaluateAccess,
  relativeDocsPath,
  resolveAccessIdentity,
} from './lib/access';
import { getDocuments } from './lib/documents';
import { generateMarkdown } from './lib/markdown-export';

const isPublicAsset = (path: string) =>
  path.startsWith('/_astro/')
  || path.startsWith('/assets/')
  || /\.(?:css|js|mjs|map|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf)$/i.test(path);

const varyAccept = (response: Response): Response => {
  const headers = new Headers(response.headers);
  const vary = new Set((headers.get('Vary') ?? '').split(',').map((value) => value.trim()).filter(Boolean));
  vary.add('Accept');
  headers.set('Vary', [...vary].join(', '));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

const privateResponse = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  const vary = new Set((headers.get('Vary') ?? '').split(',').map((value) => value.trim()).filter(Boolean));
  vary.add('Cookie');
  vary.add('Authorization');
  if (docsyConfig.access.provider.type === 'header') vary.add(docsyConfig.access.provider.tierHeader);
  headers.set('Vary', [...vary].join(', '));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

export const onRequest = defineMiddleware(async (context, next) => {
  // Preserve the initial recognized context across Astro's 404 rewrites.
  if (isServer) context.locals.docsyNotFoundContext ??= parseDocsPath(context.url.pathname)?.context ?? defaultContext;
  if (!isServer || context.isPrerendered) return next();
  const relativePath = relativeDocsPath(context.url.pathname);
  if (relativePath === null || isPublicAsset(relativePath) || relativePath === '/locked' || relativePath === '/404' || relativePath === '/404.html') return next();

  // Resolve explicit aliases before broad SDK/article routes claim the request.
  // Authorization follows the destination, so aliases cannot bypass its gate.
  const redirectTarget = docsyConfig.redirects[relativePath.replace(/\/+$/, '')] ?? docsyConfig.redirects[relativePath];
  const accessPath = accessPathForRequest(redirectTarget ?? relativePath);
  const identity = docsyConfig.access.mode === 'locked' ? await resolveAccessIdentity(context.request, accessPath) : { authenticated: false, tiers: [] };
  context.locals.docsyAccess = identity;

  // Search is filtered per identity in its endpoint rather than being locked
  // as a whole, so public results keep working for every visitor.
  const aggregate = ['/search-index.json', '/agent/index.json', '/agent/query.json', '/llms.txt', '/llms-full.txt'].includes(relativePath);
  if (aggregate) {
    if (docsyConfig.access.mode === 'locked' && relativePath !== '/search-index.json' && !evaluateAccess(relativePath, identity).allowed) return privateResponse(new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }));
    return docsyConfig.access.mode === 'locked' ? privateResponse(await next()) : next();
  }

  const decision = evaluateAccess(accessPath, identity);
  if (docsyConfig.access.mode === 'open' || decision.allowed) {
    if (redirectTarget) {
      const response = context.redirect(docsPath(redirectTarget), 301);
      return docsyConfig.access.mode === 'locked' ? privateResponse(response) : response;
    }
    const document = getDocuments().find((doc) => doc.path === context.url.pathname.replace(/\/+$/, '') || doc.path === context.url.pathname);
    if (document && context.request.headers.get('accept')?.includes('text/markdown')) {
      const markdown = await generateMarkdown(document.path, docsyConfig.site.origin, identity.tiers);
      const response = new Response(markdown, { headers: { 'Content-Type': 'text/markdown; charset=utf-8', Vary: 'Accept' } });
      return docsyConfig.access.mode === 'locked' ? privateResponse(response) : response;
    }
    const response = await next();
    const negotiated = document ? varyAccept(response) : response;
    return docsyConfig.access.mode === 'locked' ? privateResponse(negotiated) : negotiated;
  }

  const status = identity.authenticated ? 403 : 401;
  if (relativePath.startsWith('/agent/')) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
  if (relativePath.startsWith('/format-md/') || context.request.headers.get('accept')?.includes('text/markdown')) {
    return new Response(
      `# Documentation locked\n\nThis page requires one of: ${decision.requiredTiers.join(', ')}.\n`,
      {
        status,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Cache-Control': 'private, no-store',
          Vary: 'Cookie, Authorization',
        },
      },
    );
  }

  const gate = new URL(docsPath('/locked'), 'http://docsy.local');
  gate.searchParams.set('returnTo', `${context.url.pathname}${context.url.search}`);
  gate.searchParams.set('required', decision.requiredTiers.join(','));
  gate.searchParams.set('reason', identity.authenticated ? 'tier' : 'signin');
  return context.redirect(`${gate.pathname}${gate.search}`, 302);
});
