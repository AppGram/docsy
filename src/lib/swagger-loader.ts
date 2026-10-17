import { readFile } from 'node:fs/promises';
import { load as loadYaml } from 'js-yaml';
import { docsyConfig, resolveSource, type ApiSectionConfig } from '../config';

export type SwaggerParam = {
  name: string;
  in: 'path' | 'query' | 'header' | 'body' | 'formData';
  required?: boolean;
  description?: string;
  type?: string;
  schema?: SwaggerSchema;
};

export type SwaggerSchema = {
  $ref?: string;
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, SwaggerSchema>;
  items?: SwaggerSchema;
  required?: string[];
  enum?: unknown[];
  example?: unknown;
};

export type SwaggerOperation = {
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: SwaggerParam[];
  responses?: Record<string, { description?: string; schema?: SwaggerSchema }>;
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: SwaggerSchema }>;
  };
  security?: Array<Record<string, string[]>>;
};

export type SwaggerSpec = {
  swagger?: string;
  openapi?: string;
  host?: string;
  basePath?: string;
  info?: { title?: string; version?: string; description?: string };
  paths?: Record<string, Record<string, SwaggerOperation>>;
  definitions?: Record<string, SwaggerSchema>;
  components?: {
    schemas?: Record<string, SwaggerSchema>;
    securitySchemes?: Record<string, unknown>;
  };
  securityDefinitions?: Record<string, unknown>;
  security?: Array<Record<string, string[]>>;
};

const openapiConfig = docsyConfig.ingestion.openapi;
export const API_BASE_URL = openapiConfig.apiBaseUrl.replace(/\/$/, '');

let cache: SwaggerSpec | null = null;
let cachePromise: Promise<SwaggerSpec | null> | null = null;

const parseSpec = (source: string): SwaggerSpec => {
  const parsed = loadYaml(source);
  if (!parsed || typeof parsed !== 'object') throw new Error('OpenAPI source must contain an object');
  return parsed as SwaggerSpec;
};

export const loadSwagger = async (): Promise<SwaggerSpec | null> => {
  if (cache) return cache;
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    try {
      if (!openapiConfig.enabled) return null;
      if (/^https?:\/\//.test(openapiConfig.source)) {
        const res = await fetch(openapiConfig.source, { headers: { accept: 'application/json, application/yaml, text/yaml' } });
        if (!res.ok) return null;
        cache = parseSpec(await res.text());
      } else {
        cache = parseSpec(await readFile(resolveSource(openapiConfig.source), 'utf8'));
      }
      return cache;
    } catch {
      return null;
    }
  })();
  return cachePromise;
};

export const API_SECTIONS: ApiSectionConfig[] = openapiConfig.sections;

export type ApiSection = ApiSectionConfig;

export type NormalizedEndpoint = {
  id: string;
  method: string;
  path: string;
  tag?: string;
  summary?: string;
  description?: string;
  needsAuth: boolean;
  pathParams: SwaggerParam[];
  queryParams: SwaggerParam[];
  headerParams: SwaggerParam[];
  bodyProperties: { name: string; type: string; required: boolean; description?: string }[];
  curl: string;
  responseExample?: string;
  successCode?: string;
};

const resolveSchema = (schema: SwaggerSchema | undefined, spec: SwaggerSpec, depth = 0): SwaggerSchema | undefined => {
  if (!schema || depth > 8) return schema;
  if (schema.$ref) {
    const ref = schema.$ref.replace('#/definitions/', '').replace('#/components/schemas/', '');
    const target = spec.definitions?.[ref] ?? spec.components?.schemas?.[ref];
    return target ? resolveSchema(target, spec, depth + 1) : schema;
  }
  return schema;
};

const requiresAuth = (op: SwaggerOperation, globalSecurity: SwaggerSpec['security']): boolean => {
  if (op.security !== undefined) return op.security.length > 0;
  return (globalSecurity?.length ?? 0) > 0;
};

const exampleForSchema = (schema: SwaggerSchema | undefined, spec: SwaggerSpec, depth = 0): unknown => {
  const resolved = resolveSchema(schema, spec, depth);
  if (!resolved || depth > 4) return undefined;
  if (resolved.example !== undefined) return resolved.example;
  const type = resolved.type;
  if (type === 'string') return resolved.format === 'date-time' ? new Date(0).toISOString() : resolved.enum?.[0] ?? 'string';
  if (type === 'integer' || type === 'number') return 0;
  if (type === 'boolean') return true;
  if (type === 'array') return [exampleForSchema(resolved.items, spec, depth + 1)].filter((v) => v !== undefined);
  if (type === 'object' || resolved.properties) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(resolved.properties ?? {})) {
      const example = exampleForSchema(v, spec, depth + 1);
      if (example !== undefined) obj[k] = example;
    }
    return Object.keys(obj).length ? obj : undefined;
  }
  return undefined;
};

const buildCurl = (method: string, path: string, needsAuth: boolean, bodyExample: unknown): string => {
  const lines = [`curl --request ${method.toUpperCase()} \\`];
  lines.push(`  --url ${API_BASE_URL}${path} \\`);
  if (needsAuth) lines.push(`  --header 'Authorization: Bearer <token>' \\`);
  if (bodyExample && typeof bodyExample === 'object' && Object.keys(bodyExample as object).length > 0) {
    lines.push(`  --header 'Content-Type: application/json' \\`);
    lines.push(`  --data '${JSON.stringify(bodyExample, null, 2)}'`);
  } else {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/ \\$/, '');
  }
  return lines.join('\n');
};

const collectBodyProps = (schema: SwaggerSchema | undefined, spec: SwaggerSpec): NormalizedEndpoint['bodyProperties'] => {
  const resolved = resolveSchema(schema, spec);
  if (!resolved?.properties) return [];
  const required = new Set(resolved.required ?? []);
  return Object.entries(resolved.properties).map(([name, prop]) => ({
    name,
    type: prop.$ref ? 'object' : (prop.type ?? 'object'),
    required: required.has(name),
    description: prop.description,
  }));
};

const matchesSection = (op: SwaggerOperation, path: string, section: ApiSection): boolean => {
  const tags = (op.tags ?? []).map((t) => t.toLowerCase());
  const tagHit = section.tags.some((filter) => tags.some((t) => t.includes(filter)));
  const pathHit = section.paths.some((pattern) => path.toLowerCase().includes(pattern.toLowerCase()));
  return tagHit || pathHit;
};

export const filterEndpoints = (spec: SwaggerSpec | null, section: ApiSection): NormalizedEndpoint[] => {
  if (!spec?.paths) return [];
  const result: NormalizedEndpoint[] = [];
  const globalSecurity = spec.security;
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

  for (const [path, ops] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(ops)) {
      if (!methods.includes(method.toLowerCase())) continue;
      if (!matchesSection(op, path, section)) continue;

      const params = op.parameters ?? [];
      const pathParams = params.filter((p) => p.in === 'path');
      const queryParams = params.filter((p) => p.in === 'query');
      const headerParams = params.filter((p) => p.in === 'header' && p.name.toLowerCase() !== 'authorization');
      const bodyParam = params.find((p) => p.in === 'body');
      const requestBodySchema = op.requestBody?.content?.['application/json']?.schema
        ?? Object.values(op.requestBody?.content ?? {})[0]?.schema;
      const bodySchema = bodyParam?.schema ?? requestBodySchema;
      const bodyProperties = collectBodyProps(bodySchema, spec);
      const needsAuth = requiresAuth(op, globalSecurity);
      const bodyExample = ['post', 'put', 'patch'].includes(method.toLowerCase())
        ? exampleForSchema(bodySchema, spec)
        : undefined;
      const curl = buildCurl(method, path, needsAuth, bodyExample);

      const responses = op.responses ?? {};
      const successCode = Object.keys(responses).find((c) => c.startsWith('2')) ?? '200';
      const response = responses[successCode] as (typeof responses)[string] & {
        content?: Record<string, { schema?: SwaggerSchema }>;
      };
      const responseSchema = response?.schema
        ?? response?.content?.['application/json']?.schema
        ?? Object.values(response?.content ?? {})[0]?.schema;
      const responseExampleObj = exampleForSchema(responseSchema, spec);
      const responseExample = responseExampleObj !== undefined
        ? JSON.stringify(responseExampleObj, null, 2)
        : undefined;

      const id = `${method}-${path}`.replace(/[^a-zA-Z0-9-]/g, '-');
      result.push({
        id,
        method: method.toLowerCase(),
        path,
        tag: op.tags?.[0],
        summary: op.summary,
        description: op.description,
        needsAuth,
        pathParams,
        queryParams,
        headerParams,
        bodyProperties,
        curl,
        responseExample,
        successCode,
      });
    }
  }
  return result;
};
