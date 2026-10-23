#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { dump, load } from 'js-yaml';
import { writeTemplateManifest } from './project-tools.mjs';
import { deploymentGuide, writeWorkflows } from './scaffold/workflows.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const invocationRoot = process.cwd();
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head']);

const usage = `Create an editable Docsy site from the reference UI.

Usage:
  docsy create <directory> [options]
  create-docsy <directory> [options]

Options:
  --name <name>          Product or API name
  --openapi <source>     OpenAPI JSON/YAML file or URL
  --api-base <url>       Request base URL shown in API examples
  --base <path>          Documentation mount path (default: /docs)
  --locked               Enable the server-side permission gate
  --open                 Generate a static public site (default)
  --yes, -y              Accept defaults without prompts
  --no-install           Do not install npm dependencies
  --ci                   Include validation and static-preview artifact workflow
  --deploy <target>      none (default) or github-pages; deployment is opt-in/gated
  --repo <url>           Your GitHub repository URL (required for Pages scaffold)
  --force                Replace an existing target directory
  --help, -h             Show this help
`;

const fail = (message) => {
  console.error(`\nDocsy could not create the project: ${message}\n`);
  process.exit(1);
};

const parseArguments = (argv) => {
  const options = {
    target: '',
    name: '',
    openapi: '',
    apiBase: '',
    base: '',
    access: '',
    yes: false,
    install: true,
    force: false,
    help: false,
    ci: false,
    deployment: 'none',
    repo: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const takeValue = (flag) => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) fail(`${flag} requires a value`);
      index += 1;
      return value;
    };

    if (argument === '--name') options.name = takeValue(argument);
    else if (argument === '--openapi') options.openapi = takeValue(argument);
    else if (argument === '--api-base') options.apiBase = takeValue(argument);
    else if (argument === '--base') options.base = takeValue(argument);
    else if (argument === '--locked') options.access = 'locked';
    else if (argument === '--open') options.access = 'open';
    else if (argument === '--yes' || argument === '-y') options.yes = true;
    else if (argument === '--no-install') options.install = false;
    else if (argument === '--ci') options.ci = true;
    else if (argument === '--deploy') options.deployment = takeValue(argument);
    else if (argument === '--repo') options.repo = takeValue(argument);
    else if (argument === '--force') options.force = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else if (argument.startsWith('-')) fail(`unknown option ${argument}`);
    else if (!options.target) options.target = argument;
    else fail(`unexpected argument ${argument}`);
  }

  if (!['none', 'github-pages'].includes(options.deployment)) fail('--deploy must be none or github-pages');
  if (options.repo && !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(options.repo)) fail('--repo must be an HTTPS GitHub owner/repository URL');
  if (options.deployment === 'github-pages' && !options.repo) fail('--deploy github-pages requires --repo https://github.com/OWNER/REPOSITORY');
  if (options.deployment === 'github-pages' && options.access === 'locked') fail('GitHub Pages cannot host permission-gated documentation. Use Node/Bun.');
  return options;
};

const humanize = (value) => value
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[-_]+/g, ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase())
  .trim();

const slugify = (value) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'docs';

const normalizeBasePath = (value) => {
  const clean = (value || '/docs').trim();
  if (clean === '/') return '/';
  return `/${clean.replace(/^\/+|\/+$/g, '')}`;
};

const plainText = (value) => String(value ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
  .replace(/[`*_#]/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ')
  .trim();

const parseSpec = (source, label) => {
  const parsed = load(source);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail(`${label} does not contain an OpenAPI object`);
  }
  return parsed;
};

const loadOpenApi = async (source) => {
  if (!source) {
    const spec = {
      openapi: '3.1.0',
      info: {
        title: 'Example API',
        version: '1.0.0',
        description: 'Replace sources/openapi.json with your OpenAPI document.',
      },
      servers: [{ url: 'http://localhost:3000' }],
      paths: {},
    };
    return {
      spec,
      configSource: 'sources/openapi.json',
      localName: 'openapi.json',
      sourceText: `${JSON.stringify(spec, null, 2)}\n`,
    };
  }

  if (/^https?:\/\//i.test(source)) {
    let response;
    try {
      response = await fetch(source, {
        headers: { accept: 'application/json, application/yaml, text/yaml' },
      });
    } catch (error) {
      fail(`could not fetch ${source}: ${error.message}`);
    }
    if (!response.ok) fail(`${source} returned HTTP ${response.status}`);
    const sourceText = await response.text();
    return {
      spec: parseSpec(sourceText, source),
      configSource: source,
      localName: '',
      sourceText: '',
    };
  }

  const absoluteSource = resolve(invocationRoot, source);
  if (!existsSync(absoluteSource) || !statSync(absoluteSource).isFile()) {
    fail(`OpenAPI file not found: ${absoluteSource}`);
  }
  const sourceText = readFileSync(absoluteSource, 'utf8');
  const extension = ['.yaml', '.yml'].includes(extname(absoluteSource).toLowerCase())
    ? extname(absoluteSource).toLowerCase()
    : '.json';
  const localName = `openapi${extension}`;
  return {
    spec: parseSpec(sourceText, absoluteSource),
    configSource: `sources/${localName}`,
    localName,
    sourceText,
  };
};

const operationEntries = (spec) => {
  const entries = [];
  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method.toLowerCase()) || !operation || typeof operation !== 'object') continue;
      entries.push({ path, method: method.toLowerCase(), operation });
    }
  }
  return entries;
};

const sectionTitle = (value) => humanize(value.replace(/\bapi\b/gi, 'API'));

const deriveSections = (spec) => {
  const grouped = new Map();
  for (const entry of operationEntries(spec)) {
    const firstSegment = entry.path.split('/').filter(Boolean).find((part) => !part.startsWith('{'));
    const rawGroup = entry.operation.tags?.[0] || firstSegment || 'General';
    const key = String(rawGroup).trim() || 'General';
    const existing = grouped.get(key) ?? {
      raw: key,
      description: '',
      paths: new Set(),
    };
    existing.paths.add(entry.path);
    grouped.set(key, existing);
  }

  const tagDescriptions = new Map(
    (spec.tags ?? [])
      .filter((tag) => tag?.name)
      .map((tag) => [String(tag.name), String(tag.description ?? '')]),
  );
  const used = new Set();

  return [...grouped.values()].map((group) => {
    const baseSlug = slugify(group.raw);
    let section = baseSlug;
    let suffix = 2;
    while (used.has(section)) {
      section = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
    used.add(section);
    return {
      section,
      title: sectionTitle(group.raw),
      description: plainText(tagDescriptions.get(group.raw)) || `Endpoints in the ${sectionTitle(group.raw)} API.`,
      tags: [],
      paths: [...group.paths],
    };
  });
};

const inferApiBase = (spec, source) => {
  const serverUrl = spec.servers?.find((server) => typeof server?.url === 'string')?.url;
  if (serverUrl && /^https?:\/\//i.test(serverUrl) && !serverUrl.includes('{')) return serverUrl.replace(/\/$/, '');

  if (spec.host) {
    const scheme = spec.schemes?.[0] || 'https';
    return `${scheme}://${spec.host}${spec.basePath ?? ''}`.replace(/\/$/, '');
  }

  if (/^https?:\/\//i.test(source)) return new URL(source).origin;
  return 'http://localhost:3000';
};

const safeRemove = (path) => {
  if (existsSync(path)) rmSync(path, { recursive: true, force: true });
};

const copyTemplate = (target) => {
  const entries = [
    'src',
    'public',
    'scripts',
    'astro.config.mjs',
    'tsconfig.json',
    'Dockerfile',
    'Dockerfile.bun',
    'compose.yaml',
    'LICENSE',
    '.github/workflows/docsy-maintenance.yml',
    '.dockerignore',
    '.gitignore',
  ];
  for (const entry of entries) {
    // npm deliberately excludes .gitignore; ship it under a neutral asset name.
    const source = resolve(packageRoot, entry === '.gitignore' ? 'scripts/scaffold/gitignore' : entry);
    if (!existsSync(source)) fail(`the packaged template is missing ${entry}`);
    cpSync(source, resolve(target, entry), { recursive: true });
  }
};

const makePackageJson = (target, projectName) => {
  const template = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
  const packageName = slugify(basename(target) || projectName);
  const generated = {
    name: packageName,
    version: '0.1.0',
    private: true,
    license: 'Elastic-2.0',
    type: 'module',
    scripts: {
      docsy: 'node scripts/docsy.mjs',
      dev: 'node scripts/docsy.mjs dev',
      validate: 'node scripts/docsy.mjs validate',
      check: 'node scripts/docsy.mjs validate',
      build: 'node scripts/docsy.mjs build',
      stage: 'node scripts/stage-deployment.mjs',
      preview: 'node scripts/docsy.mjs preview',
      start: 'node scripts/start.mjs',
      'start:bun': 'bun scripts/start.mjs',
      maintain: 'node scripts/docsy.mjs maintain',
    },
    dependencies: template.dependencies,
    devDependencies: template.devDependencies,
    engines: template.engines,
    docsy: { templateVersion: template.docsy?.templateVersion ?? template.version, generator: '@appgram/docsy' },
  };
  writeFileSync(resolve(target, 'package.json'), `${JSON.stringify(generated, null, 2)}\n`);

  const lockPath = resolve(target, 'package-lock.json');
  if (existsSync(lockPath)) {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
    lock.name = packageName;
    lock.version = '0.1.0';
    lock.packages[''].name = packageName;
    lock.packages[''].version = '0.1.0';
    delete lock.packages[''].bin;
    writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  }
};

const makeConfig = ({ projectName, description, basePath, accessMode, apiBase, configSource, sections }) => {
  const apiItems = sections.map((section) => ({
    title: section.title,
    icon: 'tabler:api',
    href: `/api/${section.section}`,
  }));
  const firstApiPath = apiItems[0]?.href ?? '/guides/getting-started';
  const rules = [];
  if (sections.length > 1) {
    rules.push({ pattern: `/api/${sections.at(-1).section}`, tiers: ['enterprise'] });
  }
  rules.push({ pattern: '/api/**', tiers: ['developer', 'enterprise'] });

  const config = {
    site: {
      name: projectName,
      docsLabel: 'docs',
      title: `${projectName} Documentation`,
      description,
      origin: '${DOCSY_ORIGIN:-http://localhost:4321}',
      basePath,
      language: 'en',
      homeUrl: basePath === '/' ? '/' : `${basePath}/`,
      logo: 'assets/docsy-mark.svg',
      favicon: 'assets/docsy-mark.svg',
    },
    header: {
      searchLabel: 'Search documentation',
      searchPlaceholder: 'Search docs and API endpoints',
      llmLabel: 'LLM Docs',
    },
    sidebar: { iconSize: 16 },
    eyebrow: {
      icon: 'assets/docsy-logo.svg',
      size: 14,
    },
    notFound: {
      layout: 'centered',
      eyebrow: 'Page not found',
      title: 'This page isn’t here.',
      description: 'The link may have changed, or the page may have moved. Let’s get you back to the documentation.',
      showCode: true,
      showSearch: true,
      searchLabel: 'Search documentation',
      primaryAction: { label: 'Back to docs', href: '/' },
      links: [{ label: 'Getting started', href: '/guides/getting-started' }],
    },
    theme: {
      mode: 'light',
      colors: {
        ink: '#111116',
        muted: '#4f515c',
        softMuted: '#777985',
        line: '#dfdfe8',
        paper: '#ffffff',
        accent: '#5188ff',
        accentDark: '#3d6fe6',
        panel: '#191a20',
        success: '#57c468',
      },
      fonts: {
        display: '"Aptos Display", "SF Pro Display", "Helvetica Neue", sans-serif',
        body: '"Aptos", "SF Pro Text", "Helvetica Neue", sans-serif',
        label: '"Aptos", "SF Pro Text", "Helvetica Neue", sans-serif',
        mono: 'ui-monospace, "SF Mono", Menlo, monospace',
      },
    },
    home: {
      eyebrow: 'DOCUMENTATION',
      articleLayout: 'grid',
      title: `Build with ${projectName}.`,
      description,
      primaryAction: { label: 'Explore the API →', href: firstApiPath },
      sdkHeading: 'API reference',
      sdkDescription: 'Generated directly from the configured OpenAPI source.',
    },
    reader: { headingLinks: true, showByline: true, editEnabled: true, editPlacement: 'footer', editStyle: 'subtle' },
    authors: {},
    content: {
      media: { enabled: true, images: true, videos: true },
      mdx: { enabled: true, allowJavaScript: false, components: {} },
      components: ['note', 'tip', 'warning', 'danger', 'steps', 'tabs', 'accordion', 'code-group', 'include', 'card', 'frame', 'drawio', 'plantuml'],
      mermaid: { enabled: true, maxTextSize: 50000, maxEdges: 500 },
      diagrams: {},
      snippets: {},
      articles: [
        {
          slug: 'getting-started',
          source: 'content/getting-started.md',
          title: 'Getting started',
          description: `Start building with ${projectName}.`,
          eyebrow: 'GUIDE',
        },
      ],
    },
    search: { enabled: true, maxResults: 30 },
    agent: { enabled: true, query: false, maxResults: 10, maxQueryLength: 500 },
    validation: { links: true, api: true },
    versions: { default: 'current', items: [{ id: 'current', label: 'Current' }] },
    maintenance: {
      enabled: false,
      watch: ['sources/**', 'src/**'],
      docs: ['content/**/*.md', 'README.md'],
      breakingChangesFile: 'content/maintenance/breaking-changes.md',
    },
    access: {
      mode: accessMode,
      provider: {
        type: 'header',
        tierHeader: 'x-docsy-tiers',
        userHeader: 'x-docsy-user',
      },
      tiers: {
        developer: {
          label: 'Developer',
          description: 'Standard API reference access.',
        },
        enterprise: {
          label: 'Enterprise',
          description: 'Restricted API reference access.',
        },
      },
      rules,
      gate: {
        eyebrow: 'RESTRICTED DOCUMENTATION',
        title: 'This API reference is locked.',
        description: 'Sign in with an account whose documentation tier includes this reference.',
        loginLabel: 'Sign in to continue',
        returnToParam: 'returnTo',
        backLabel: 'Back to public docs',
      },
    },
    navigation: [
      {
        title: 'Introduction',
        items: [
          { title: 'Overview', href: '/', icon: 'lucide:house' },
          { title: 'Getting started', href: '/guides/getting-started', icon: 'lucide:book-open' },
        ],
      },
      ...(apiItems.length ? [{ title: 'API Reference', items: apiItems }] : []),
    ],
    ingestion: {
      sdks: [],
      openapi: {
        enabled: true,
        source: configSource,
        apiBaseUrl: apiBase,
        sections,
      },
    },
  };

  const yaml = dump(config, {
    lineWidth: 120,
    noRefs: true,
    noCompatMode: true,
    quotingType: '"',
  });
  return `# Content, branding, ingestion, navigation, and permission gates live here.\n# The interface itself remains editable source under src/.\n${yaml}`;
};

const makeProjectDocs = ({ target, projectName, basePath, openapi, apiBase, accessMode, sections }) => {
  const readme = `# ${projectName} documentation

This project was generated by Docsy as editable Astro source. Its interface is the reference Docsy UI; this is not a theme downloaded at runtime.

## Start

Use Node 22.22 or newer to install dependencies, develop, and build. The production server can run on Node or Bun 1.3.5 or newer.

\`\`\`bash
npm install
npm run dev
\`\`\`

Open \`http://localhost:4321${basePath === '/' ? '/' : `${basePath}/`}\`.

## Configure

- \`docsy.config.yaml\` controls product copy, navigation, visual tokens, OpenAPI/SDK sources, and permission tiers.
- \`content/\` contains Markdown or MDX guides registered under \`content.articles\` in YAML. MDX is declarative by default; \`content.mdx.allowJavaScript\` explicitly enables trusted executable source.
- \`content.components\` and \`content.snippets\` configure rich Markdown blocks and reusable content.
- \`versions\` and \`localization\` configure variant routes, selectors, and language fallbacks.
- \`agent.query: true\` enables a JSON query endpoint and requires the Node/Bun server; keep it false for static hosting.
- \`src/layouts/DocsLayout.astro\`, \`src/components/docs/\`, and \`src/styles/docsy.css\` are the editable interface.
- \`sources/\` contains local ingestion inputs.
- \`DOCSY_BRIEF.md\` tells an AI coding agent what it may customize without drifting from the reference UI.

The included Docsy software is licensed under the Elastic License 2.0. You may
self-host and customize it for your own documentation, but you may not offer
substantial Docsy functionality to third parties as a hosted or managed service.
See \`LICENSE\` for the controlling terms.

Useful commands:

\`\`\`bash
npm run validate
npm run build
npm run preview
\`\`\`

For a Bun production runtime, build with Node as above, then run:

\`\`\`bash
HOST=0.0.0.0 PORT=8080 npm run start:bun
\`\`\`

The same command serves the staged static build or the permission-gated server build. \`Dockerfile.bun\` provides a Node-build/Bun-runtime container. Bun's package manager and the end-to-end Bun build toolchain are not part of this runtime support claim.

## Automatic documentation maintenance

The generated \`.github/workflows/docsy-maintenance.yml\` workflow can propose
documentation updates after source changes. Enable \`maintenance.enabled\` in YAML,
add the \`OPENAI_API_KEY\` Actions secret, and allow Actions to create pull requests.
Source comparisons, scoped documentation edits, validation, and a draft PR run in
separate stages. Local inspection: \`npm run maintain -- plan --base HEAD~1\`.
Local agent run: \`npm run maintain -- run --base HEAD~1\` (authenticated Codex CLI).

The generated access mode is \`${accessMode}\`. In locked mode, put Docsy behind a trusted identity proxy that removes client-supplied identity headers before setting \`x-docsy-tiers\`.
`;

  const gettingStarted = `Start here, then replace this article with the onboarding path for ${projectName}.

## Configure the project

Open \`docsy.config.yaml\` to change product copy, navigation, authored articles, ingestion sources, theme tokens, and access rules.

## Run locally

\`\`\`bash
npm run dev
\`\`\`

## Validate before deployment

\`\`\`bash
npm run validate
npm run build
\`\`\`
`;

  const agents = `# Docsy project rules

- Preserve the existing Docsy interface, component hierarchy, type scale, spacing, colors, radii, shadows, and responsive behavior unless the user explicitly requests a visual change.
- Never add typographic tracking. Do not introduce external or fingerprinting font services.
- Treat \`docsy.config.yaml\` as the source of truth for branding, navigation, ingestion sources, access tiers, and stable visual tokens.
- Treat \`src/\` as source-owned UI. Make intentional component edits there when the user asks for behavior or layout changes.
- Do not replace the interface with a generated theme or a different documentation framework.
- Keep permission checks server-side in locked mode. Never expose protected source files from \`public/\`.
- Run \`npm run validate\` and \`npm run build\` after material changes.
- Preserve permission filtering in search, JSON, Markdown, and discovery exports. Never turn locked content into a public static index.
`;

  const brief = `# Docsy customization brief

## Product

- Name: ${projectName}
- Documentation base path: ${basePath}
- OpenAPI source: ${openapi || 'sources/openapi.json'}
- API request base URL: ${apiBase}
- Access mode: ${accessMode}
- Generated API sections: ${sections.length}

## Responsibility boundary

YAML owns product copy, authored article registration, navigation, ingestion, colors, font stacks, and access rules. Markdown or MDX owns guide content. MDX JavaScript execution requires explicit trust; never enable it for unchecked source or agent-generated code. Astro/CSS source owns the interface. Start from the generated interface and change only what the request calls for.

## Suggested AI kickoff

Read \`AGENTS.md\`, \`DOCSY_BRIEF.md\`, and \`docsy.config.yaml\`. Inspect the existing UI before editing it. Preserve its visual language. Update the YAML for content or access changes; update the Astro components only for requested interface behavior. Validate and build before reporting completion.
`;

  writeFileSync(resolve(target, 'README.md'), readme);
  mkdirSync(resolve(target, 'content'), { recursive: true });
  writeFileSync(resolve(target, 'content/getting-started.md'), gettingStarted);
  writeFileSync(resolve(target, 'AGENTS.md'), agents);
  writeFileSync(resolve(target, 'DOCSY_BRIEF.md'), brief);
};

const options = parseArguments(process.argv.slice(2));
if (options.help) {
  console.log(usage);
  process.exit(0);
}

let prompt;
if (!options.yes) prompt = createInterface({ input, output });

try {
  if (!options.target) {
    if (!prompt) fail('a target directory is required');
    options.target = (await prompt.question('Project directory: ')).trim();
  }
  if (!options.target) fail('a target directory is required');

  if (!options.openapi && prompt) {
    options.openapi = (await prompt.question('OpenAPI file or URL (leave blank for a starter): ')).trim();
  }

  const openapi = await loadOpenApi(options.openapi);
  const suggestedName = (options.openapi && openapi.spec.info?.title) || humanize(basename(options.target));
  if (!options.name && prompt) {
    options.name = (await prompt.question(`Product name (${suggestedName}): `)).trim();
  }
  options.name ||= suggestedName;

  if (!options.base && prompt) {
    options.base = (await prompt.question('Documentation base path (/docs): ')).trim();
  }
  const repository = options.repo ? new URL(options.repo).pathname.split('/').filter(Boolean) : [];
  const suggestedBase = options.deployment === 'github-pages' ? (repository[1].toLowerCase() === `${repository[0].toLowerCase()}.github.io` ? '/' : `/${repository[1]}`) : '/docs';
  const basePath = normalizeBasePath(options.base || suggestedBase);

  if (!options.access && prompt) {
    const locked = (await prompt.question('Enable permission-gated lock mode? (y/N): ')).trim().toLowerCase();
    options.access = ['y', 'yes'].includes(locked) ? 'locked' : 'open';
  }
  options.access ||= 'open';
  if (options.deployment === 'github-pages' && options.access === 'locked') fail('GitHub Pages cannot host permission-gated documentation.');

  const target = resolve(invocationRoot, options.target);
  if (target === invocationRoot || target === packageRoot || target === resolve('/')) {
    fail('choose a dedicated project directory');
  }
  if (existsSync(target) && readdirSync(target).length > 0) {
    if (!options.force) fail(`${target} is not empty; use --force only if it may be replaced`);
    rmSync(target, { recursive: true, force: true });
  }
  mkdirSync(target, { recursive: true });

  const sections = deriveSections(openapi.spec);
  const apiBase = (options.apiBase || inferApiBase(openapi.spec, options.openapi)).replace(/\/$/, '');
  const description = plainText(openapi.spec.info?.description) || `Reference documentation for the ${options.name} API.`;

  copyTemplate(target);
  mkdirSync(resolve(target, 'sources'), { recursive: true });
  if (openapi.localName) writeFileSync(resolve(target, 'sources', openapi.localName), openapi.sourceText);

  cpSync(resolve(packageRoot, 'scripts/scaffold/index.astro'), resolve(target, 'src/pages/index.astro'));
  cpSync(resolve(packageRoot, 'scripts/scaffold/format-md.ts'), resolve(target, 'src/pages/format-md/[...path].ts'));
  safeRemove(resolve(target, 'src/pages/getting-started.astro'));
  safeRemove(resolve(target, 'src/pages/api-authentication.astro'));
  safeRemove(resolve(target, 'src/components/docs/ComingSoon.astro'));
  safeRemove(resolve(target, 'public/assets/ag-logo.svg'));

  makePackageJson(target, options.name);
  const config = load(makeConfig({
    projectName: options.name,
    description,
    basePath,
    accessMode: options.access,
    apiBase,
    configSource: openapi.configSource,
    sections,
  }));
  if (options.repo) {
    config.site.githubUrl = options.repo.replace(/\/$/, '');
    config.reader = { ...config.reader, editUrl: `${config.site.githubUrl}/edit/main/{source}`, reportUrl: `${config.site.githubUrl}/issues/new` };
  }
  if (options.deployment === 'github-pages') config.site.origin = `https://${repository[0]}.github.io`;
  writeFileSync(resolve(target, 'docsy.config.yaml'), dump(config, { lineWidth: 120, noRefs: true }));
  writeWorkflows(target, { ci: options.ci, deployment: options.deployment });
  writeFileSync(resolve(target, 'DEPLOYING.md'), deploymentGuide({ deployment: options.deployment, repo: options.repo, basePath }));
  makeProjectDocs({
    target,
    projectName: options.name,
    basePath,
    openapi: options.openapi,
    apiBase,
    accessMode: options.access,
    sections,
  });
  const upgradeGuide = existsSync(resolve(packageRoot, 'UPGRADING.md')) ? 'UPGRADING.md' : 'content/reference/upgrading.md';
  writeFileSync(resolve(target, 'UPGRADING.md'), readFileSync(resolve(packageRoot, upgradeGuide), 'utf8'));
  const templatePackage = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
  writeTemplateManifest(target, templatePackage.docsy?.templateVersion ?? templatePackage.version, options.deployment);

  if (options.install) {
    console.log('\nInstalling dependencies…');
    const result = spawnSync('npm', ['install'], { cwd: target, stdio: 'inherit', env: process.env });
    if (result.error) throw result.error;
    if (result.status !== 0) fail('npm install failed; the project files were still generated');
  }

  console.log(`\nCreated ${options.name} documentation at ${target}`);
  console.log(`Discovered ${sections.length} API ${sections.length === 1 ? 'section' : 'sections'}.`);
  console.log('\nNext steps:');
  console.log(`  cd ${options.target}`);
  if (!options.install) console.log('  npm install');
  console.log('  npm run dev');
  console.log('  npm run docsy -- doctor');
  console.log('  Read DEPLOYING.md for content → preview → your chosen host.');
  if (options.deployment === 'github-pages') console.log(`\nWhen you explicitly choose to publish: enable Pages (GitHub Actions), set repository variable DOCSY_ENABLE_PAGES=true and run Deploy documentation. Expected URL: https://${repository[0]}.github.io${basePath === '/' ? '/' : `${basePath}/`}. Nothing has been deployed.`);
  console.log('\nGive your coding agent DOCSY_BRIEF.md when you want it to customize the generated source.');
} finally {
  prompt?.close();
}
