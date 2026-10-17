import { defineMiddleware } from 'astro:middleware';
import { docsPath, docsyConfig } from './config';
import {
  accessPathForRequest,
  evaluateAccess,
  relativeDocsPath,
  resolveAccessIdentity,
} from './lib/access';

const isPublicAsset = (path: string) =>
  path.startsWith('/_astro/')
  || path.startsWith('/assets/')
  || /\.(?:css|js|mjs|map|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf)$/i.test(path);

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
  if (docsyConfig.access.mode === 'open') return next();

  const relativePath = relativeDocsPath(context.url.pathname);
  if (relativePath === null || isPublicAsset(relativePath) || relativePath === '/locked') return next();

  const accessPath = accessPathForRequest(relativePath);
  const identity = await resolveAccessIdentity(context.request, accessPath);
  context.locals.docsyAccess = identity;

  // Search is filtered per identity in its endpoint rather than being locked
  // as a whole, so public results keep working for every visitor.
  if (relativePath === '/search-index.json') return privateResponse(await next());

  const decision = evaluateAccess(accessPath, identity);
  if (decision.allowed) return privateResponse(await next());

  const status = identity.authenticated ? 403 : 401;
  if (relativePath.startsWith('/format-md/')) {
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
