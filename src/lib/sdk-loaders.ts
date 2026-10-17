import { readFileSync } from 'node:fs';
import { docsyConfig, resolveSource, type SdkSourceConfig } from '../config';

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
};

export type NormalizedCategory = {
  title: string;
  items: NormalizedItem[];
};

export type SDKDoc = {
  name: string;
  language: string;
  install: string;
  overview: string;
  itemCount: number;
  categories: NormalizedCategory[];
};

const readJson = <T,>(source: string): T | null => {
  try {
    const raw = readFileSync(resolveSource(source), 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
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
// Swift (iOS) — { modules[0].types|protocols|enums, navigation.categories[{items:[fullName]}] }
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
  description?: { abstract?: string };
  signature?: { returnType?: string; parameters?: { name: string; type: string; label?: string }[] };
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
  cases?: { name: string }[];
};
type IOSData = {
  modules: { types?: IOSType[]; protocols?: IOSType[]; enums?: IOSType[] }[];
  navigation: { categories: { title: string; items: string[] }[] };
};

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
          ...(t.initializers ?? []).map((m) => ({
            name: m.name,
            isAsync: m.isAsync,
            isStatic: m.isStatic,
            returnType: undefined,
            description: m.description?.abstract?.trim() || undefined,
            parameters: (m.signature?.parameters ?? []).map((p) => ({ name: p.name, type: p.type })),
          })),
          ...(t.methods ?? []).map((m) => ({
            name: m.name,
            isAsync: m.isAsync,
            isStatic: m.isStatic,
            returnType: m.signature?.returnType && m.signature.returnType !== 'Void' ? m.signature.returnType : undefined,
            description: m.description?.abstract?.trim() || undefined,
            parameters: (m.signature?.parameters ?? []).map((p) => ({ name: p.name, type: p.type })),
          })),
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

const FLUTTER_CATEGORY_KEYWORDS: Array<[string, RegExp]> = [
  ['Provider', /Provider|AppgramProvider/],
  ['Wishes', /Wish|Vote|Comment/],
  ['Roadmap', /Roadmap/],
  ['Releases', /Release|Changelog/],
  ['Help Center', /Help/],
  ['Support', /Support|Ticket/],
  ['Surveys', /Survey/],
  ['Status', /Status|Incident/],
  ['Blog', /Blog|Post/],
  ['Theme', /Theme|Color|Typography/],
  ['Hooks', /^use[A-Z]/],
];

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
    const match = FLUTTER_CATEGORY_KEYWORDS.find(([, re]) => re.test(it.name));
    put(match ? match[0] : 'Other', item);
  }

  const order = FLUTTER_CATEGORY_KEYWORDS.map(([t]) => t).concat(['Other']);
  const categories: NormalizedCategory[] = order
    .filter((title) => buckets.has(title))
    .map((title) => ({
      title,
      items: buckets.get(title)!.sort((a, b) => a.name.localeCompare(b.name)),
    }));

  return { ...meta, itemCount: surface.length, categories };
};

// ---------------------------------------------------------------------------
// Embed — TypeDoc project with { children[{ kind, name, children[] }] }
// TypeDoc kinds: 128=class, 256=interface, 2097152=type, 8=enum, 64=function
// ---------------------------------------------------------------------------
type EmbedChild = { id: number; name: string; kind: number; children?: EmbedChild[]; comment?: { summary?: { text: string }[] } };
type EmbedData = { children?: EmbedChild[] };

const TYPEDOC_KIND_LABEL: Record<number, string> = {
  8: 'enum',
  32: 'variable',
  64: 'function',
  128: 'class',
  256: 'interface',
  1024: 'property',
  2048: 'method',
  4194304: 'type',
  2097152: 'type',
};

const loadEmbedShape = (source: string, meta: Omit<SDKDoc, 'itemCount' | 'categories'>): SDKDoc => {
  const data = readJson<EmbedData>(source);
  if (!data?.children) return { ...meta, itemCount: 0, categories: [] };

  const buckets = new Map<string, NormalizedItem[]>();
  const put = (title: string, item: NormalizedItem) => {
    if (!buckets.has(title)) buckets.set(title, []);
    buckets.get(title)!.push(item);
  };

  for (const child of data.children) {
    const kind = TYPEDOC_KIND_LABEL[child.kind] || 'symbol';
    const summary = child.comment?.summary?.map((s) => s.text).join('').trim() || undefined;
    const item: NormalizedItem = {
      id: slug(child.name),
      name: child.name,
      kind,
      summary,
      language: 'typescript',
    };
    const cat = kind === 'class' ? 'Classes'
      : kind === 'interface' ? 'Interfaces'
      : kind === 'function' ? 'Functions'
      : kind === 'enum' ? 'Enums'
      : 'Types';
    put(cat, item);
  }

  const order = ['Classes', 'Interfaces', 'Functions', 'Enums', 'Types'];
  const categories: NormalizedCategory[] = order
    .filter((title) => buckets.has(title))
    .map((title) => ({
      title,
      items: buckets.get(title)!.sort((a, b) => a.name.localeCompare(b.name)),
    }));

  return { ...meta, itemCount: data.children.length, categories };
};

// ---------------------------------------------------------------------------
// Adapter registry. Each adapter converts an existing generator's JSON shape
// into the stable SDKDoc model consumed by pages, search, and markdown export.
// ---------------------------------------------------------------------------
type SdkAdapter = (source: string, meta: Omit<SDKDoc, 'itemCount' | 'categories'>) => SDKDoc;

export const SDK_ADAPTERS: Record<SdkSourceConfig['adapter'], SdkAdapter> = {
  'typedoc-lite': loadReactShape,
  'swift-symbols': loadIOSShape,
  dartdoc: loadFlutterShape,
  typedoc: loadEmbedShape,
};

export const loadSdk = (config: SdkSourceConfig): SDKDoc => {
  const adapter = SDK_ADAPTERS[config.adapter];
  if (!adapter) throw new Error(`Unknown SDK ingestion adapter: ${config.adapter}`);
  return adapter(config.source, {
    name: config.name,
    language: config.language,
    install: config.install,
    overview: config.overview,
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
