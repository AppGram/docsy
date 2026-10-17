import type { SDKDoc, NormalizedItem, NormalizedCategory } from './sdk-loaders';
import { getSdkSources, loadSdk } from './sdk-loaders';
import { docsPath, docsyConfig, type ApiSectionConfig } from '../config';
import { loadSwagger, filterEndpoints, API_SECTIONS, type NormalizedEndpoint } from './swagger-loader';
import { articleMarkdownExport, articleRoute, getArticleSources } from './article-loader';

const codeFence = (lang: string, body: string) => `\`\`\`${lang}\n${body}\n\`\`\``;

const itemToMarkdown = (item: NormalizedItem): string => {
  const out: string[] = [];
  out.push(`### \`${item.name}\`  <sub>${item.kind}</sub>`);
  if (item.summary) out.push(item.summary);
  if (item.deprecated) {
    const note = typeof item.deprecated === 'string' ? `: ${item.deprecated}` : '';
    out.push(`> **Deprecated**${note}`);
  }
  if (item.parameters?.length) {
    out.push('**Parameters**');
    out.push('| Name | Type | Required | Description |');
    out.push('| --- | --- | --- | --- |');
    for (const p of item.parameters) {
      out.push(`| \`${p.name}\` | \`${p.type}\` | ${p.optional ? '' : '✓'} | ${p.description ?? ''} |`);
    }
  }
  if (item.returnType) {
    out.push(`**Returns** — \`${item.returnType}\`${item.returnsDoc ? ` — ${item.returnsDoc}` : ''}`);
  }
  if (item.values?.length) {
    out.push(`**Values** — ${item.values.map((v) => `\`${v}\``).join(', ')}`);
  }
  if (item.properties?.length) {
    out.push('**Properties**');
    out.push('| Name | Type | Required | Description | Default |');
    out.push('| --- | --- | --- | --- | --- |');
    for (const p of item.properties) {
      out.push(
        `| \`${p.name}\` | \`${p.type}\` | ${p.optional ? '' : '✓'} | ${p.description ?? ''} | ${p.defaultValue ? `\`${p.defaultValue}\`` : ''} |`,
      );
    }
  }
  if (item.methods?.length) {
    out.push('**Methods**');
    for (const m of item.methods) {
      const tags = [m.isAsync ? 'async' : null, m.isStatic ? 'static' : null].filter(Boolean).join(' ');
      const ret = m.returnType ? ` → \`${m.returnType}\`` : '';
      out.push(`- \`${m.name}\`${tags ? ` — ${tags}` : ''}${ret}${m.description ? `  \n  ${m.description}` : ''}`);
      for (const p of m.parameters) {
        out.push(`  - \`${p.name}: ${p.type}\`${p.optional ? ' (optional)' : ''}${p.description ? ` — ${p.description}` : ''}`);
      }
    }
  }
  if (item.declaration) {
    out.push(codeFence(item.language, item.declaration));
  }
  if (item.example) {
    out.push('**Example**');
    out.push(codeFence(item.language, item.example));
  }
  return out.join('\n\n');
};

const categoryToMarkdown = (cat: NormalizedCategory): string => {
  const items = cat.items.map(itemToMarkdown).join('\n\n---\n\n');
  return `## ${cat.title}\n\n${items}`;
};

const sdkToMarkdown = (doc: SDKDoc, sourceUrl: string): string => {
  const header = [
    `# ${doc.name}`,
    doc.overview,
    `> Source: ${sourceUrl}  \n> Language: ${doc.language}  \n> Symbols: ${doc.itemCount} across ${doc.categories.length} categories`,
    '## Install',
    codeFence('bash', doc.install),
    '## Categories',
    doc.categories.map((c) => `- [${c.title}](#${c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}) — ${c.items.length} items`).join('\n'),
  ].join('\n\n');
  return `${header}\n\n${doc.categories.map(categoryToMarkdown).join('\n\n')}\n`;
};

const endpointToMarkdown = (e: NormalizedEndpoint): string => {
  const out: string[] = [];
  out.push(`### ${e.summary || e.path}`);
  if (e.description) out.push(e.description);
  out.push(`**\`${e.method.toUpperCase()}\`** \`${e.path}\``);
  if (e.needsAuth) out.push('_Requires_ `Authorization: Bearer <token>`');
  const table = (title: string, rows: { name: string; type: string; required?: boolean; description?: string }[]) => {
    if (!rows.length) return;
    out.push(`**${title}**`);
    out.push('| Name | Type | Required | Description |');
    out.push('| --- | --- | --- | --- |');
    for (const p of rows) {
      out.push(`| \`${p.name}\` | \`${p.type}\` | ${p.required ? '✓' : ''} | ${p.description ?? ''} |`);
    }
  };
  table('Path parameters', e.pathParams.map((p) => ({ name: p.name, type: p.type || p.schema?.type || 'string', required: p.required, description: p.description })));
  table('Query parameters', e.queryParams.map((p) => ({ name: p.name, type: p.type || p.schema?.type || 'string', required: p.required, description: p.description })));
  table('Header parameters', e.headerParams.map((p) => ({ name: p.name, type: p.type || p.schema?.type || 'string', required: p.required, description: p.description })));
  table('Body', e.bodyProperties);
  out.push('**Request**');
  out.push(codeFence('bash', e.curl));
  if (e.responseExample) {
    out.push(`**Response** — \`${e.successCode ?? '200'}\``);
    out.push(codeFence('json', e.responseExample));
  }
  return out.join('\n\n');
};

const apiSectionToMarkdown = async (section: ApiSectionConfig, sourceUrl: string): Promise<string> => {
  const spec = await loadSwagger();
  const endpoints = filterEndpoints(spec, section);
  const version = spec?.info?.version?.replace(/^v/i, '');
  const header = [
    `# ${section.title}`,
    section.description,
    `> Source: ${sourceUrl}  \n> Endpoints: ${endpoints.length}${version ? `  \n> API version: v${version}` : ''}`,
  ].join('\n\n');
  const guide = docsyConfig.ingestion.openapi.guide;
  const guideNote = guide ? `\n\nSee [${guide.label}](${docsPath(guide.href)}) for the base setup.` : '';
  const body = endpoints.map(endpointToMarkdown).join('\n\n---\n\n');
  return `${header}${guideNote}\n\n${body}\n`;
};

const STATIC_PAGES: Record<string, string> = {
  '/': `# ${docsyConfig.site.name} Documentation\n\n${docsyConfig.site.description}\n\n## Sections\n\n${docsyConfig.navigation.flatMap((section) => section.items).map((item) => `- ${item.title} — [${docsPath(item.href)}](${docsPath(item.href)}?format=md)`).join('\n')}\n`,
};

export const generateMarkdown = async (path: string, origin: string): Promise<string | null> => {
  const clean = path.replace(/\/+$/, '') || '/';
  const base = docsPath();
  const relative = base !== '/' && clean.startsWith(base)
    ? clean.slice(base.length) || '/'
    : clean;
  const source = `${origin}${docsPath(relative)}`;

  if (STATIC_PAGES[relative]) return STATIC_PAGES[relative];

  const article = getArticleSources().find((candidate) => articleRoute(candidate) === relative);
  if (article) return articleMarkdownExport(article);

  const sdkSource = getSdkSources().find((sdk) => `/${sdk.slug}` === relative);
  if (sdkSource) return sdkToMarkdown(loadSdk(sdkSource), source);

  const apiMatch = relative.match(/^\/api\/([a-z-]+)$/);
  if (apiMatch) {
    const section = API_SECTIONS.find((s) => s.section === apiMatch[1]);
    if (section) return apiSectionToMarkdown(section, source);
  }

  return null;
};
