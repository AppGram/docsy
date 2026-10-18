import { readFileSync, statSync } from 'node:fs';
import { docsyConfig, resolveSource, type SdkSourceConfig } from '../config';
import { loadNativeSdk } from './native-sdk';
import { SDK_FORMATS } from './sdk-formats';

export type NormalizedParameter = {
  name: string;
  type: string;
  optional?: boolean;
  description?: string;
};

export type NormalizedProperty = {
  name: string;
  type: string;
  optional?: boolean;
  description?: string;
  defaultValue?: string;
};

export type NormalizedMethod = {
  name: string;
  isAsync?: boolean;
  isStatic?: boolean;
  returnType?: string;
  description?: string;
  parameters: NormalizedParameter[];
};

export type NormalizedItem = {
  id: string;
  name: string;
  kind: string;
  summary?: string;
  declaration?: string;
  language: string;
  href?: string;
  deprecated?: string | boolean;
  parameters?: NormalizedParameter[];
  returnType?: string;
  returnsDoc?: string;
  properties?: NormalizedProperty[];
  methods?: NormalizedMethod[];
  values?: string[];
  example?: string;
  exampleLanguage?: string;
  remarks?: string;
  throws?: { type: string; description?: string }[];
  category?: string;
  relationships?: { name: string; target?: string }[];
};

export type NormalizedCategory = {
  title: string;
  items: NormalizedItem[];
};

export type SDKDoc = {
  name: string;
  language: string;
  install: string;
  installLanguage?: string;
  overview: string;
  quickstart?: { code: string; language: string };
  itemCount: number;
  categories: NormalizedCategory[];
};

const readJson = <T,>(source: string): T | null => {
  try {
    const raw = readFileSync(resolveSource(source), 'utf-8');
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(`Could not ingest SDK source ${source}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------------------------------------------------------------------------
// React / React Native — TypeDoc-lite shape { modules[0].types[], navigation.categories[] }
// ---------------------------------------------------------------------------
type ReactParam = {
  name: string;
  type: string;
  optional?: boolean;
  description?: { summary?: string } | null;
};
type ReactProperty = {
  name: string;
  type: string;
  optional?: boolean;
  description?: { summary?: string; defaultValue?: string } | null;
};
type ReactMethod = {
  name: string;
  isAsync?: boolean;
  isStatic?: boolean;
  returnType?: string;
  description?: { summary?: string } | null;
  parameters?: ReactParam[];
};
type ReactType = {
  kind: string;
  name: string;
  access?: string;
  description?: {
    summary?: string;
    example?: string;
    returns?: string;
    deprecated?: string | boolean;
  } | null;
  declaration?: string;
  parameters?: ReactParam[];
  properties?: ReactProperty[];
  methods?: ReactMethod[];
  values?: string[];
  returnType?: string;
};
type ReactData = {
  modules: { types: ReactType[] }[];
  navigation: { categories: { title: string; items: string[] }[] };
};

const normReactParam = (p: ReactParam): NormalizedParameter => ({
  name: p.name,
  type: p.type,
  optional: p.optional,
  description: p.description?.summary?.trim() || undefined,
});

const loadReactShape = (path: string, meta: Omit<SDKDoc, 'itemCount' | 'categories'>): SDKDoc => {
  const data = readJson<ReactData>(path);
  if (!data) return { ...meta, itemCount: 0, categories: [] };

  const types = data.modules?.[0]?.types ?? [];
  const byName = new Map(types.map((t) => [t.name, t]));

  const categories: NormalizedCategory[] = (data.navigation?.categories ?? []).map((cat) => ({
    title: cat.title,
    items: cat.items
      .map((n) => byName.get(n))
      .filter((t): t is ReactType => Boolean(t))
      .map((t) => {
        let example = t.description?.example?.trim();
        if (!example && t.kind === 'hook') example = `const result = ${t.name}();`;
        else if (!example && t.kind === 'component') example = `<${t.name} />`;
        return {
          id: slug(t.name),
          name: t.name,
          kind: t.kind,
          summary: t.description?.summary?.trim() || undefined,
          declaration: t.declaration?.trim() || undefined,
          language: meta.language,
          deprecated: t.description?.deprecated,
          parameters: t.parameters?.map(normReactParam),
          returnType: t.returnType && t.returnType !== 'void' ? t.returnType : undefined,
          returnsDoc: t.description?.returns?.trim() || undefined,
          properties: t.properties?.map((p) => ({
            name: p.name,
            type: p.type,
            optional: p.optional,
            description: p.description?.summary?.trim() || undefined,
            defaultValue: p.description?.defaultValue?.trim() || undefined,
          })),
          methods: t.methods?.map((m) => ({
            name: m.name,
            isAsync: m.isAsync,
            isStatic: m.isStatic,
            returnType: m.returnType && m.returnType !== 'void' ? m.returnType : undefined,
            description: m.description?.summary?.trim() || undefined,
            parameters: (m.parameters ?? []).map(normReactParam),
          })),
          values: t.values,
          example,
        };
      }),
  })).filter((c) => c.items.length > 0);

  return { ...meta, itemCount: types.length, categories };
};

// ---------------------------------------------------------------------------
// AppGram/docc2json — modules[0].types|protocols|enums + navigation.categories.
// ---------------------------------------------------------------------------
type IOSProperty = {
  name: string;
  type: string;
  isStatic?: boolean;
  declaration?: string;
  description?: { abstract?: string };
};
type IOSMethod = {
  name: string;
  isStatic?: boolean;
  isAsync?: boolean;
  throws?: boolean;
  declaration?: string;
  description?: { abstract?: string; discussion?: string };
  signature?: { returnType?: string; async?: boolean; throws?: boolean; keywords?: string[]; parameters?: { name: string; type: string; label?: string; isOptional?: boolean; defaultValue?: string; description?: string }[] };
};
type IOSType = {
  kind: string;
  name: string;
  fullName?: string;
  description?: { abstract?: string; discussion?: string; examples?: Array<{ code: string }> };
  declaration?: string;
  properties?: IOSProperty[];
  methods?: IOSMethod[];
  initializers?: IOSMethod[];
  requirements?: (IOSMethod & { kind: string })[];
  cases?: { name: string }[];
};
type IOSData = {
  modules: { types?: IOSType[]; protocols?: IOSType[]; enums?: IOSType[] }[];
  navigation: { categories: { title: string; items: string[] }[] };
};

const normalizeSwiftMethod = (method: IOSMethod, initializer = false): NormalizedMethod => ({
  name: method.name,
  isAsync: method.isAsync ?? method.signature?.async,
  isStatic: method.isStatic ?? method.signature?.keywords?.includes('static'),
  returnType: !initializer && method.signature?.returnType && method.signature.returnType !== 'Void' ? method.signature.returnType : undefined,
  description: (method.description?.abstract || method.description?.discussion)?.trim() || undefined,
  parameters: (method.signature?.parameters ?? []).map((parameter) => ({
    name: parameter.name, type: parameter.type,
    // docc2json's isOptional describes a nullable Swift type, not an omittable argument.
    optional: parameter.defaultValue !== undefined || undefined,
    description: parameter.description?.trim() || undefined,
  })),
});

const loadIOSShape = (source: string, meta: Omit<SDKDoc, 'itemCount' | 'categories'>): SDKDoc => {
  const data = readJson<IOSData>(source);
  if (!data) return { ...meta, itemCount: 0, categories: [] };

  const m0 = data.modules?.[0] ?? { types: [], protocols: [], enums: [] };
  const all = [...(m0.types ?? []), ...(m0.protocols ?? []), ...(m0.enums ?? [])];
  const byKey = new Map<string, IOSType>();
  all.forEach((t) => {
    byKey.set(t.name, t);
    if (t.fullName) byKey.set(t.fullName, t);
  });

  const categories: NormalizedCategory[] = (data.navigation?.categories ?? []).map((cat) => ({
    title: cat.title,
    items: cat.items
      .map((n) => byKey.get(n))
      .filter((t): t is IOSType => Boolean(t))
      .map((t) => ({
        id: slug(t.fullName || t.name),
        name: t.name,
        kind: t.kind,
        summary: (t.description?.abstract || t.description?.discussion || '').trim() || undefined,
        declaration: t.declaration?.trim() || undefined,
        language: 'swift',
        properties: t.properties?.map((p) => ({
          name: p.name,
          type: p.type,
          description: p.description?.abstract?.trim() || undefined,
        })),
        methods: [
          ...(t.initializers ?? []).map((method) => normalizeSwiftMethod(method, true)),
          ...(t.methods ?? []).map((method) => normalizeSwiftMethod(method)),
          ...(t.requirements ?? []).filter((requirement) => ['func', 'method', 'init', 'initializer'].includes(requirement.kind))
            .map((requirement) => normalizeSwiftMethod(requirement, ['init', 'initializer'].includes(requirement.kind))),
        ],
        values: t.cases?.map((c) => c.name),
        example: t.description?.examples?.[0]?.code?.trim() || undefined,
      })),
  })).filter((c) => c.items.length > 0);

  return { ...meta, itemCount: all.length, categories };
};

// ---------------------------------------------------------------------------
// Flutter — flat list of items each with { name, qualifiedName, kind (int), desc }
// Kind constants from copy: 1=lib, 3=class, 5=enum, 8=extension, 9=package, 10=const, 15=method, 16=function, 17=property
// ---------------------------------------------------------------------------
type FlutterItem = {
  name: string;
  qualifiedName?: string;
  kind: number;
  desc?: string;
  href?: string;
  packageRank?: number;
};

const FLUTTER_KIND_LABEL: Record<number, string> = {
  1: 'library',
  3: 'class',
  5: 'enum',
  8: 'extension',
  9: 'package',
  10: 'constant',
  15: 'method',
  16: 'function',
  17: 'property',
};

const DART_CATEGORIES: Record<number, string> = { 3: 'Classes', 5: 'Enums', 8: 'Extensions' };

const loadFlutterShape = (source: string, meta: Omit<SDKDoc, 'itemCount' | 'categories'>): SDKDoc => {
  const items = readJson<FlutterItem[]>(source) ?? [];
  // Focus on top-level types (classes, enums, extensions) so we don't drown in every getter/method
  const surface = items.filter((it) => [3, 5, 8].includes(it.kind));

  const buckets = new Map<string, NormalizedItem[]>();
  const put = (title: string, item: NormalizedItem) => {
    if (!buckets.has(title)) buckets.set(title, []);
    buckets.get(title)!.push(item);
  };

  for (const it of surface) {
    const item: NormalizedItem = {
      id: slug(it.qualifiedName || it.name),
      name: it.name,
      kind: FLUTTER_KIND_LABEL[it.kind] || 'symbol',
      summary: (it.desc || '').trim() || undefined,
      language: 'dart',
    };
    put(DART_CATEGORIES[it.kind], item);
  }

  const order = ['Classes', 'Enums', 'Extensions'];
  const categories: NormalizedCategory[] = order
    .filter((title) => buckets.has(title))
    .map((title) => ({
      title,
      items: buckets.get(title)!.sort((a, b) => a.name.localeCompare(b.name)),
    }));

  return { ...meta, itemCount: surface.length, categories };
};

// ---------------------------------------------------------------------------
// Native generator artifacts and legacy compact converters share SDKDoc.
// ---------------------------------------------------------------------------
type SdkAdapter = (source: string, meta: Omit<SDKDoc, 'itemCount' | 'categories'>) => SDKDoc;

export const SDK_ADAPTERS: Record<SdkSourceConfig['adapter'], SdkAdapter> = {
  ...Object.fromEntries(SDK_FORMATS.map((format) => [format, (source: string, meta: Omit<SDKDoc, 'itemCount' | 'categories'>) => loadNativeSdk({ source, adapter: format, maxFiles: 10000, maxFileBytes: 10 * 1024 * 1024, maxTotalBytes: 100 * 1024 * 1024 } as SdkSourceConfig, meta)])) as Record<SdkSourceConfig['adapter'], SdkAdapter>,
  'typedoc-lite': loadReactShape,
  'swift-symbols': loadIOSShape,
  dartdoc: (source, meta) => statSync(resolveSource(source)).isDirectory() ? loadNativeSdk({ source, adapter: 'dartdoc' } as SdkSourceConfig, meta) : loadFlutterShape(source, meta),
};

export const loadSdk = (config: SdkSourceConfig): SDKDoc => {
  const adapter = SDK_ADAPTERS[config.adapter];
  if (!adapter) throw new Error(`Unknown SDK ingestion adapter: ${config.adapter}`);
  const meta = { name: config.name, language: config.language, install: config.install, installLanguage: config.installLanguage ?? (config.adapter === 'swift-symbols' ? 'swift' : 'bash'), overview: config.overview, quickstart: config.quickstart ? { code: config.quickstart.code, language: config.quickstart.language ?? config.language } : undefined };
  if (!['typedoc-lite', 'swift-symbols'].includes(config.adapter) && !(config.adapter === 'dartdoc' && !statSync(resolveSource(config.source)).isDirectory())) return loadNativeSdk({ ...config, source: resolveSource(config.source) }, meta);
  const data = readJson<any>(config.source);
  const valid = config.adapter === 'dartdoc' ? Array.isArray(data) : config.adapter === 'typedoc' ? Array.isArray(data?.children) : Array.isArray(data?.modules);
  if (!valid) throw new Error(`SDK source ${config.source} does not match the ${config.adapter} adapter shape.`);
  return adapter(config.source, {
    name: config.name,
    language: config.language,
    install: config.install,
    installLanguage: config.installLanguage ?? (config.adapter === 'swift-symbols' ? 'swift' : 'bash'),
    overview: config.overview,
    quickstart: config.quickstart ? { code: config.quickstart.code, language: config.quickstart.language ?? config.language } : undefined,
  });
};

export const getSdkSources = (): SdkSourceConfig[] => docsyConfig.ingestion.sdks;

export const getSdkSource = (idOrSlug: string): SdkSourceConfig | undefined =>
  getSdkSources().find((source) => source.id === idOrSlug || source.slug === idOrSlug);

export const loadSdkById = (idOrSlug: string): SDKDoc | null => {
  const source = getSdkSource(idOrSlug);
  return source ? loadSdk(source) : null;
};

// Compatibility exports keep the current page/content integration
// working while the dynamic route and search index use the registry above.
const requireSdk = (id: string): SDKDoc => {
  const doc = loadSdkById(id);
  if (!doc) throw new Error(`Missing SDK source "${id}" in docsy.config.yaml`);
  return doc;
};

export const loadReactSDK = (): SDKDoc => requireSdk('react');
export const loadReactNativeSDK = (): SDKDoc => requireSdk('react-native');
export const loadFlutterSDK = (): SDKDoc => requireSdk('flutter');
export const loadSwiftSDK = (): SDKDoc => requireSdk('swift');
export const loadEmbedSDK = (): SDKDoc => requireSdk('embed');
