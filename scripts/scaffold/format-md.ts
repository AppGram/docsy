import type { APIRoute } from 'astro';
import { docsPath, docsyConfig } from '../../config';
import { generateMarkdown } from '../../lib/markdown-export';
import { getSdkSources } from '../../lib/sdk-loaders';
import { API_SECTIONS } from '../../lib/swagger-loader';

export const prerender = docsyConfig.access.mode !== 'locked';

const allowedTargets = () => [
  ...getSdkSources().map((sdk) => `/${sdk.slug}`),
  ...API_SECTIONS.map((section) => `/api/${section.section}`),
];

export async function getStaticPaths() {
  return allowedTargets().map((target) => ({
    params: { path: target.replace(/^\/+/, '') },
    props: { target: docsPath(target) },
  }));
}

export const GET: APIRoute = async ({ params, props, url }) => {
  const relativeTarget = `/${params.path ?? ''}`.replace(/\/+$/, '');
  if (!allowedTargets().includes(relativeTarget)) {
    return new Response('# Not found\n', {
      status: 404,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  }

  const target = (props as { target?: string }).target ?? docsPath(relativeTarget);
  const origin = `${url.protocol}//${url.host}`;
  const markdown = await generateMarkdown(target, origin);
  if (markdown === null) {
    return new Response('# Not found\n', {
      status: 404,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  }
  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
};
