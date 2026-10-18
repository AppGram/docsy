import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';
import { z } from 'zod';
import { maintenanceSchema } from '../scripts/maintenance/config.mjs';

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
  items?: NavItemInput[];
};

const navItemSchema: z.ZodType<NavItemInput> = z.lazy(() => z.object({
  title: z.string().min(1),
  href: z.string().min(1),
  icon: z.string().optional(),
  items: z.array(navItemSchema).optional(),
}));

const sdkSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  adapter: z.enum(['typedoc-lite', 'swift-symbols', 'dartdoc', 'typedoc']),
  source: z.string().min(1),
  name: z.string().min(1),
  language: z.string().min(1),
  install: z.string(),
  overview: z.string(),
  icon: z.string().optional(),
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
    prefix: z.string().default('Built by'),
    label: z.string().min(1),
    href: z.string().url(),
  }).optional(),
  theme: z.object({
    mode: z.enum(['light', 'dark']).default('light'),
    colors: themeColorsSchema(LIGHT_THEME_COLORS),
    lightColors: themeColorsSchema(LIGHT_THEME_COLORS),
    darkColors: themeColorsSchema(DARK_THEME_COLORS),
    fonts: z.object({
      display: z.string().default('"Aptos Display", "SF Pro Display", "Helvetica Neue", sans-serif'),
      body: z.string().default('"Aptos", "SF Pro Text", "Helvetica Neue", sans-serif'),
      label: z.string().default('"Aptos", "SF Pro Text", "Helvetica Neue", sans-serif'),
      mono: z.string().default('ui-monospace, "SF Mono", Menlo, monospace'),
    }).default({}),
  }).default({}),
  home: z.object({
    eyebrow: z.string().default('DOCUMENTATION'),
    title: z.string().min(1),
    description: z.string().min(1),
    primaryAction: actionSchema,
    secondaryAction: actionSchema.optional(),
    sdkHeading: z.string().default('Choose your platform'),
    sdkDescription: z.string().default('Official SDKs with full type support and identical primitives across every runtime.'),
  }),
  content: z.object({
    articles: z.array(articleSchema).default([]),
  }).default({}),
  access: accessSchema,
  maintenance: maintenanceSchema,
  navigation: z.array(z.object({
    title: z.string().min(1),
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
    }),
  }),
}).superRefine((config, context) => {
  const articleSlugs = new Set<string>();
  config.content.articles.forEach((article, articleIndex) => {
    if (articleSlugs.has(article.slug)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['content', 'articles', articleIndex, 'slug'],
        message: `Duplicate article slug "${article.slug}"`,
      });
    }
    articleSlugs.add(article.slug);
  });

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

export const DOCSY_ROOT = projectRoot;

const base = docsyConfig.site.basePath === '/'
  ? ''
  : `/${docsyConfig.site.basePath.replace(/^\/+|\/+$/g, '')}`;

export const docsPath = (path = ''): string => {
  if (/^(?:https?:)?\/\//.test(path) || path.startsWith('mailto:') || path.startsWith('#')) return path;
  const clean = path.replace(/^\/+/, '');
  return `${base}/${clean}`.replace(/\/$/, '') || '/';
};

export const assetPath = (path: string): string => {
  if (/^(?:https?:)?\/\//.test(path) || path.startsWith('data:')) return path;
  return docsPath(path);
};

export const resolveSource = (path: string): string => resolve(projectRoot, path);
