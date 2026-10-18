import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';
import { z } from 'zod';
import { maintenanceSchema } from '../scripts/maintenance/config.mjs';
import { REQUEST_LANGUAGES } from './lib/request-languages';
import { SDK_FORMATS } from './lib/sdk-formats';
import { bundledThemes } from 'shiki';

// Astro bundles server modules into dist during static generation, so module
// URLs no longer point at the project. Builds and dev both run from this root.
const projectRoot = process.cwd();
const configFile = resolve(projectRoot, process.env.DOCSY_CONFIG || 'docsy.config.yaml');

const actionSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

type NavItemInput = {
  title: string;
  href: string;
  icon?: string;
  titles?: Record<string, string>;
  items?: NavItemInput[];
};

const navItemSchema: z.ZodType<NavItemInput> = z.lazy(() => z.object({
  title: z.string().min(1),
  href: z.string().min(1),
  icon: z.string().optional(),
  titles: z.record(z.string()).optional(),
  items: z.array(navItemSchema).optional(),
}));

const sdkSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  adapter: z.enum(SDK_FORMATS),
  source: z.string().min(1),
  name: z.string().min(1),
  language: z.string().min(1),
  install: z.string(),
  installLanguage: z.string().optional(),
  quickstart: z.object({ code: z.string().min(1), language: z.string().optional() }).optional(),
  overview: z.string(),
  icon: z.string().optional(),
  iconDark: z.string().optional(),
  versions: z.record(z.string()).default({}),
  maxFiles: z.number().int().min(1).max(50000).default(10000),
  maxFileBytes: z.number().int().min(1024).max(100 * 1024 * 1024).default(10 * 1024 * 1024),
  maxTotalBytes: z.number().int().min(1024).max(1024 * 1024 * 1024).default(100 * 1024 * 1024),
});

const apiSectionSchema = z.object({
  section: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  description: z.string(),
  tags: z.array(z.string()).default([]),
  paths: z.array(z.string()).default([]),
});

const articleSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:[\/-][a-z0-9]+)*$/),
  source: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  eyebrow: z.string().default('GUIDE'),
  version: z.string().optional(),
  locale: z.string().optional(),
});

const accessProviderSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('header'),
    tierHeader: z.string().min(1).default('x-docsy-tiers'),
    userHeader: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal('webhook'),
    endpoint: z.string().url(),
    method: z.enum(['GET', 'POST']).default('GET'),
    forwardHeaders: z.array(z.string().min(1)).default(['cookie', 'authorization']),
    pathHeader: z.string().min(1).default('x-docsy-path'),
    timeoutMs: z.number().int().min(100).max(15_000).default(3_000),
  }),
]);

const accessSchema = z.object({
  mode: z.enum(['open', 'locked']).default('open'),
  provider: accessProviderSchema.default({ type: 'header', tierHeader: 'x-docsy-tiers' }),
  tiers: z.record(z.string().regex(/^[a-z0-9-]+$/), z.object({
    label: z.string().min(1),
    description: z.string().optional(),
  })).default({}),
  rules: z.array(z.object({
    pattern: z.string().startsWith('/'),
    tiers: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1),
  })).default([]),
  gate: z.object({
    eyebrow: z.string().default('RESTRICTED DOCUMENTATION'),
    title: z.string().default('This reference is locked.'),
    description: z.string().default('Your account needs a documentation tier with access to this page.'),
    loginUrl: z.string().min(1).optional(),
    loginLabel: z.string().default('Sign in to continue'),
    returnToParam: z.string().min(1).default('returnTo'),
    backLabel: z.string().default('Back to public docs'),
  }).default({}),
}).default({});

const LIGHT_THEME_COLORS = {
  ink: '#111116',
  muted: '#4f515c',
  softMuted: '#777985',
  line: '#dfdfe8',
  paper: '#ffffff',
  accent: '#5188ff',
  accentDark: '#3d6fe6',
  panel: '#191a20',
  success: '#57c468',
};

const DARK_THEME_COLORS = {
  ink: '#f5f5f5',
  muted: '#a3a3a3',
  softMuted: '#696969',
  line: '#262626',
  paper: '#000000',
  accent: '#ffffff',
  accentDark: '#e5e5e5',
  panel: '#050505',
  success: '#ffffff',
};

const themeColorsSchema = (defaults: typeof LIGHT_THEME_COLORS) => z.object({
  ink: z.string().default(defaults.ink),
  muted: z.string().default(defaults.muted),
  softMuted: z.string().default(defaults.softMuted),
  line: z.string().default(defaults.line),
  paper: z.string().default(defaults.paper),
  accent: z.string().default(defaults.accent),
  accentDark: z.string().default(defaults.accentDark),
  panel: z.string().default(defaults.panel),
  success: z.string().default(defaults.success),
}).default({});

const configSchema = z.object({
  site: z.object({
    name: z.string().min(1),
    docsLabel: z.string().default('docs'),
    title: z.string().min(1),
    description: z.string().min(1),
    origin: z.string().url(),
    basePath: z.string().regex(/^\//).default('/'),
    language: z.string().default('en'),
    homeUrl: z.string().min(1).default('/'),
    logo: z.string().min(1),
    logoDark: z.string().min(1).optional(),
    favicon: z.string().optional(),
    ogImage: z.string().optional(),
    githubUrl: z.string().url().optional(),
    twitterHandle: z.string().optional(),
  }),
  header: z.object({
    searchLabel: z.string().default('Search documentation'),
    searchPlaceholder: z.string().default('Search docs, SDKs, and API endpoints'),
    llmLabel: z.string().default('LLM Docs'),
    cta: actionSchema.optional(),
  }).default({}),
  footer: z.object({
    prefix: z.string().default('Docsy provided by'),
    label: z.string().min(1),
    href: z.string().url(),
  }).optional(),
  reader: z.object({
    editUrl: z.string().url().refine((value) => /^https?:\/\//i.test(value), 'Use an HTTP(S) source-edit URL').optional(),
    reportUrl: z.string().url().refine((value) => /^https?:\/\//i.test(value), 'Use an HTTP(S) issue URL').optional(),
    editLabel: z.string().default('Edit this page'),
    reportLabel: z.string().default('Report a problem'),
  }).default({}),
  redirects: z.record(z.string()).default({}),
  eyebrow: z.object({
    icon: z.string().min(1).default('assets/docsy-logo.svg'),
    size: z.number().int().min(8).max(32).default(14),
  }).default({}),
  theme: z.object({
    mode: z.enum(['light', 'dark']).default('light'),
    colors: themeColorsSchema(LIGHT_THEME_COLORS),
    lightColors: themeColorsSchema(LIGHT_THEME_COLORS),
    darkColors: themeColorsSchema(DARK_THEME_COLORS),
    code: z.object({
      lightTheme: z.string().refine((name) => Object.hasOwn(bundledThemes, name), 'Unknown bundled syntax theme').default('github-light'),
      darkTheme: z.string().refine((name) => Object.hasOwn(bundledThemes, name), 'Unknown bundled syntax theme').default('github-dark-high-contrast'),
    }).default({}),
    fonts: z.object({
      display: z.string().default('"Aptos Display", "SF Pro Display", "Helvetica Neue", sans-serif'),
      body: z.string().default('"Aptos", "SF Pro Text", "Helvetica Neue", sans-serif'),
      label: z.string().default('"Aptos", "SF Pro Text", "Helvetica Neue", sans-serif'),
      mono: z.string().default('ui-monospace, "SF Mono", Menlo, monospace'),
    }).default({}),
  }).default({}),
  home: z.object({
    eyebrow: z.string().default('DOCUMENTATION'),
    articleLayout: z.enum(['grid', 'list']).default('grid'),
    translations: z.record(z.object({
      title: z.string().optional(), description: z.string().optional(), eyebrow: z.string().optional(),
      primaryActionLabel: z.string().optional(), secondaryActionLabel: z.string().optional(),
    })).default({}),
    title: z.string().min(1),
    description: z.string().min(1),
    primaryAction: actionSchema,
    secondaryAction: actionSchema.optional(),
    image: z.object({
      src: z.string().min(1),
      alt: z.string().default(''),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
    }).optional(),
    sdkHeading: z.string().default('Choose your platform'),
    sdkDescription: z.string().default('Official SDKs with full type support and identical primitives across every runtime.'),
  }),
  content: z.object({
    articles: z.array(articleSchema).default([]),
    mdx: z.object({
      enabled: z.boolean().default(true),
      allowJavaScript: z.boolean().default(false),
      components: z.record(z.string().min(1)).default({}),
    }).default({}).superRefine((value, context) => {
      if (!value.allowJavaScript && Object.keys(value.components).length) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Custom MDX component modules execute code; explicitly enable content.mdx.allowJavaScript for trusted sources.' });
      for (const name of Object.keys(value.components)) if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) context.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid MDX component name: ${name}` });
    }),
    snippets: z.record(z.string().regex(/\.(?:md|markdown|mdown)$/i)).default({}),
    components: z.array(z.enum(['note', 'tip', 'warning', 'danger', 'steps', 'tabs', 'accordion', 'code-group', 'include', 'card', 'frame'])).default(['note', 'tip', 'warning', 'danger', 'steps', 'tabs', 'accordion', 'code-group', 'include', 'card', 'frame']),
  }).default({}),
  versions: z.object({
    default: z.string().default('current'),
    items: z.array(z.object({
      id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/),
      label: z.string().min(1),
      status: z.enum(['current', 'beta', 'deprecated']).default('current'),
    })).min(1).default([{ id: 'current', label: 'Current' }]),
  }).default({}),
  localization: z.object({
    defaultLocale: z.string(),
    fallback: z.boolean().default(true),
    locales: z.array(z.object({
      code: z.string().regex(/^[a-z]{2,3}(?:-[a-zA-Z0-9]+)*$/),
      label: z.string().min(1),
      dir: z.enum(['ltr', 'rtl']).default('ltr'),
    })).min(1),
    messages: z.record(z.record(z.string())).default({}),
  }).optional(),
  search: z.object({
    enabled: z.boolean().default(true),
    maxResults: z.number().int().min(1).max(50).default(30),
  }).default({}),
  agent: z.object({
    enabled: z.boolean().default(true),
    query: z.boolean().default(false),
    maxResults: z.number().int().min(1).max(50).default(10),
    maxQueryLength: z.number().int().min(16).max(2000).default(500),
  }).default({}),
  validation: z.object({
    links: z.boolean().default(true),
    api: z.boolean().default(true),
  }).default({}),
  access: accessSchema,
  maintenance: maintenanceSchema,
  navigation: z.array(z.object({
    title: z.string().min(1),
    titles: z.record(z.string()).optional(),
    items: z.array(navItemSchema),
  })),
  ingestion: z.object({
    sdks: z.array(sdkSchema).default([]),
    openapi: z.object({
      enabled: z.boolean().default(true),
      source: z.string().min(1),
      apiBaseUrl: z.string().url(),
      guide: actionSchema.optional(),
      sections: z.array(apiSectionSchema).default([]),
      versions: z.record(z.string()).default({}),
      examples: z.object({
        languages: z.array(z.enum(REQUEST_LANGUAGES)).min(1).refine((values) => new Set(values).size === values.length, 'Request languages must be unique').default(['curl', 'javascript', 'python']),
        defaults: z.enum(['required', 'all']).default('required'),
        customSamples: z.boolean().default(true),
      }).default({}),
    }),
  }),
}).superRefine((config, context) => {
  const canonical = (path: string) => path.replace(/\/+$/, '') || '/';
  const route = (path: string) => path.startsWith('/') && !path.includes('//') && !/[?#\\\x00-\x20]/.test(path) && !path.split('/').some((part) => part === '..' || part === '.');
  const aliases = Object.fromEntries(Object.entries(config.redirects).map(([from, to]) => [canonical(from), canonical(to)]));
  if (Object.keys(aliases).length !== Object.keys(config.redirects).length) context.addIssue({ code: 'custom', path: ['redirects'], message: 'Redirect aliases must be unique after trailing-slash normalization.' });
  for (const [from, to] of Object.entries(config.redirects)) {
    if (!route(from) || !route(to) || from === '/' || from.replace(/\/$/, '') === to.replace(/\/$/, '')) context.addIssue({ code: 'custom', path: ['redirects', from], message: 'Redirects require distinct, local canonical paths (no query, fragment or traversal).' });
    if (/^\/(?:assets|_astro|agent|format-md)(?:\/|$)|^\/(?:search-index\.json|llms\.txt|llms-full\.txt|locked)\/?$/.test(from)) context.addIssue({ code: 'custom', path: ['redirects', from], message: 'Redirects cannot shadow asset, gate or machine-readable routes.' });
    const visited = new Set([canonical(from)]); let next: string | undefined = canonical(to);
    while (next && aliases[next]) {
      if (visited.has(next)) { context.addIssue({ code: 'custom', path: ['redirects', from], message: 'Redirect cycle detected.' }); break; }
      visited.add(next); next = aliases[next];
    }
  }
  const articleSlugs = new Set<string>();
  config.content.articles.forEach((article, articleIndex) => {
    const key = `${article.version ?? '*'}:${article.locale ?? config.localization?.defaultLocale ?? config.site.language}:${article.slug}`;
    if (articleSlugs.has(key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['content', 'articles', articleIndex, 'slug'],
        message: `Duplicate article slug/version/locale "${key}"`,
      });
    }
    articleSlugs.add(key);
    if (article.version && !config.versions.items.some((v) => v.id === article.version)) context.addIssue({ code: 'custom', path: ['content', 'articles', articleIndex, 'version'], message: 'Unknown documentation version' });
    if (article.locale && !(config.localization?.locales.some((l) => l.code === article.locale) ?? article.locale === config.site.language)) context.addIssue({ code: 'custom', path: ['content', 'articles', articleIndex, 'locale'], message: 'Unknown documentation locale' });
  });

  const unique = (values: string[], path: string[]) => {
    if (new Set(values).size !== values.length) context.addIssue({ code: 'custom', path, message: 'Identifiers must be unique' });
  };
  unique(config.versions.items.map((v) => v.id), ['versions', 'items']);
  if (!config.versions.items.some((v) => v.id === config.versions.default)) context.addIssue({ code: 'custom', path: ['versions', 'default'], message: 'Default version must exist in versions.items' });
  if (config.localization) {
    unique(config.localization.locales.map((l) => l.code), ['localization', 'locales']);
    if (!config.localization.locales.some((l) => l.code === config.localization!.defaultLocale)) context.addIssue({ code: 'custom', path: ['localization', 'defaultLocale'], message: 'Default locale must exist in localization.locales' });
  }
  if (config.agent.query && !config.agent.enabled) context.addIssue({ code: 'custom', path: ['agent', 'query'], message: 'Enable agent.enabled before enabling runtime queries' });
  for (const [name, overrides] of [['openapi', config.ingestion.openapi.versions], ...config.ingestion.sdks.map((sdk) => [sdk.id, sdk.versions] as const)] as const) {
    for (const version of Object.keys(overrides)) if (!config.versions.items.some((item) => item.id === version)) context.addIssue({ code: 'custom', path: ['ingestion', name, 'versions', version], message: 'Unknown documentation version' });
  }

  const knownTiers = new Set(Object.keys(config.access.tiers));
  config.access.rules.forEach((rule, ruleIndex) => {
    rule.tiers.forEach((tier, tierIndex) => {
      if (!knownTiers.has(tier)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['access', 'rules', ruleIndex, 'tiers', tierIndex],
          message: `Unknown access tier "${tier}"`,
        });
      }
    });
  });
});

const interpolateEnv = (value: string) => value.replace(/\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/g, (_, key: string, fallback = '') => {
  const resolved = process.env[key] ?? fallback;
  if (!resolved) throw new Error(`Docsy configuration requires environment variable ${key}`);
  return resolved;
});

const source = interpolateEnv(readFileSync(configFile, 'utf8'));
const parsed = configSchema.safeParse(load(source));

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`).join('\n');
  throw new Error(`Invalid Docsy configuration at ${configFile}:\n${details}`);
}

export const docsyConfig = parsed.data;
export type DocsyConfig = z.infer<typeof configSchema>;
export type SdkSourceConfig = DocsyConfig['ingestion']['sdks'][number];
export type ApiSectionConfig = DocsyConfig['ingestion']['openapi']['sections'][number];
export type ArticleConfig = DocsyConfig['content']['articles'][number];
export type DocsContext = { version: string; locale: string };
export const locales = docsyConfig.localization?.locales ?? [{ code: docsyConfig.site.language, label: docsyConfig.site.language, dir: 'ltr' as const }];
export const defaultContext: DocsContext = { version: docsyConfig.versions.default, locale: docsyConfig.localization?.defaultLocale ?? docsyConfig.site.language };
export const allContexts: DocsContext[] = docsyConfig.versions.items.flatMap((version) => locales.map((locale) => ({ version: version.id, locale: locale.code })));
export const isDefaultContext = (context: DocsContext) => context.version === defaultContext.version && context.locale === defaultContext.locale;
export const contextPrefix = (context: DocsContext) => isDefaultContext(context) ? '' : `/versions/${context.version}/${context.locale}`;
export const isServer = docsyConfig.access.mode === 'locked' || docsyConfig.agent.query;

export const DOCSY_ROOT = projectRoot;

const base = docsyConfig.site.basePath === '/'
  ? ''
  : `/${docsyConfig.site.basePath.replace(/^\/+|\/+$/g, '')}`;

export const docsPath = (path = '', context?: DocsContext): string => {
  if (/^(?:https?:)?\/\//.test(path) || path.startsWith('mailto:') || path.startsWith('#')) return path;
  const clean = path.replace(/^\/+/, '');
  return `${base}${context ? contextPrefix(context) : ''}/${clean}`.replace(/\/$/, '') || '/';
};

export const parseDocsPath = (pathname: string): { path: string; context: DocsContext } | null => {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (base && clean !== base && !clean.startsWith(`${base}/`)) return null;
  const relative = (base ? clean.slice(base.length) : clean) || '/';
  const match = relative.match(/^\/versions\/([^/]+)\/([^/]+)(\/.*)?$/);
  if (!match) return { path: relative, context: defaultContext };
  const context = allContexts.find((c) => c.version === match[1] && c.locale === match[2]);
  return context ? { context, path: match[3] || '/' } : null;
};

export const assetPath = (path: string): string => {
  if (/^(?:https?:)?\/\//.test(path) || path.startsWith('data:')) return path;
  return docsPath(path);
};

export const resolveSource = (path: string): string => resolve(projectRoot, path);
