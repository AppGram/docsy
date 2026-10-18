import { defaultContext, docsyConfig, type ApiSectionConfig } from '../config';
import { readOpenApi } from './openapi';
import { generateRequestExamples, type ExampleRequest, type RequestExample } from './request-examples';

export type SwaggerParam = {
  name: string;
  in: 'path' | 'query' | 'header' | 'body' | 'formData';
  required?: boolean;
  description?: string;
  type?: string;
  schema?: SwaggerSchema;
  example?: unknown;
  examples?: Record<string, { value?: unknown }>;
};

export type SwaggerSchema = {
  $ref?: string;
  type?: string | string[];
  format?: string;
  description?: string;
  properties?: Record<string, SwaggerSchema>;
  items?: SwaggerSchema;
  required?: string[];
  enum?: unknown[];
  example?: unknown;
  default?: unknown;
  allOf?: SwaggerSchema[];
  oneOf?: SwaggerSchema[];
  anyOf?: SwaggerSchema[];
};

export type SwaggerOperation = {
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: SwaggerParam[];
  responses?: Record<string, { description?: string; schema?: SwaggerSchema; examples?: Record<string, unknown>; content?: Record<string, SwaggerMedia> }>;
  requestBody?: {
    required?: boolean;
    content?: Record<string, SwaggerMedia>;
  };
  security?: Array<Record<string, string[]>>;
  'x-codeSamples'?: { lang: string; label?: string; source: string }[];
};
type SwaggerMedia = { schema?: SwaggerSchema; example?: unknown; examples?: Record<string, { value?: unknown }> };

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

const cache = new Map<string, Promise<SwaggerSpec>>();
export const loadSwagger = async (version = defaultContext.version): Promise<SwaggerSpec | null> => {
  if (!openapiConfig.enabled) return null;
  const source = openapiConfig.versions[version] ?? openapiConfig.source;
  if (!cache.has(source)) cache.set(source, readOpenApi(source, docsyConfig.validation.api) as Promise<SwaggerSpec>);
  return cache.get(source)!;
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
  authDescription: string;
  pathParams: SwaggerParam[];
  queryParams: SwaggerParam[];
  headerParams: SwaggerParam[];
  bodyProperties: { name: string; type: string; required: boolean; description?: string }[];
  curl: string;
  responseExample?: string;
  successCode?: string;
  requestExamples: RequestExample[];
  request: ExampleRequest;
};

const resolveSchema = (schema: SwaggerSchema | undefined, spec: SwaggerSpec, depth = 0): SwaggerSchema | undefined => {
  if (!schema || depth > 8) return schema;
  if (schema.$ref) {
    const target = schema.$ref.startsWith('#/') ? schema.$ref.slice(2).split('/').reduce<any>((node, key) => node?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], spec) : undefined;
    return target ? resolveSchema(target, spec, depth + 1) : schema;
  }
  if (schema.allOf) {
    const parts = schema.allOf.map((part) => resolveSchema(part, spec, depth + 1)).filter(Boolean) as SwaggerSchema[];
    return { ...schema, allOf: undefined, type: 'object', properties: Object.assign({}, ...parts.map((part) => part.properties ?? {})), required: [...new Set(parts.flatMap((part) => part.required ?? []))] };
  }
  return schema;
};

const requiresAuth = (op: SwaggerOperation, globalSecurity: SwaggerSpec['security']): boolean => {
  const security = op.security ?? globalSecurity ?? [];
  return security.length > 0 && !security.some((requirement) => Object.keys(requirement).length === 0);
};

const exampleForSchema = (schema: SwaggerSchema | undefined, spec: SwaggerSpec, depth = 0): unknown => {
  const resolved = resolveSchema(schema, spec, depth);
  if (!resolved || depth > 4) return undefined;
  if (resolved.example !== undefined) return resolved.example;
  if (resolved.oneOf || resolved.anyOf) return exampleForSchema((resolved.oneOf ?? resolved.anyOf)![0], spec, depth + 1);
  const type = Array.isArray(resolved.type) ? resolved.type.find((type) => type !== 'null') ?? 'null' : resolved.type;
  if (type === 'string') return resolved.format === 'date-time' ? new Date(0).toISOString() : resolved.enum?.[0] ?? 'string';
  if (type === 'integer' || type === 'number') return 0;
  if (type === 'boolean') return true;
  if (type === 'null') return null;
  if (type === 'array') return [exampleForSchema(resolved.items, spec, depth + 1)].filter((v) => v !== undefined);
  if (type === 'object' || resolved.properties) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(resolved.properties ?? {})) {
      const example = exampleForSchema(v, spec, depth + 1);
      if (example !== undefined) obj[k] = example;
    }
    return obj;
  }
  return undefined;
};

const shellQuote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;
const securityDetails = (op: SwaggerOperation, spec: SwaggerSpec) => {
  const security = op.security ?? spec.security ?? [];
  const schemes = spec.components?.securitySchemes ?? spec.securityDefinitions ?? {};
  // Security requirement objects are alternatives (OR); keys within one are AND.
  const requirement = security.some((entry) => Object.keys(entry).length === 0) ? {} : security[0] ?? {};
  const args: string[] = [];
  const query: string[] = [];
  const descriptions: string[] = [];
  const headers: { name: string; value: string }[] = [];
  for (const name of Object.keys(requirement)) {
    const scheme = schemes[name] as Record<string, any> | undefined;
    if (!scheme) throw new Error(`Unknown OpenAPI security scheme: ${name}`);
    if (scheme.type === 'apiKey') {
      descriptions.push(`${scheme.name} (${scheme.in})`);
      if (scheme.in === 'query') query.push(`${encodeURIComponent(scheme.name)}=<api-key>`);
      else {
        const header = { name: scheme.in === 'cookie' ? 'Cookie' : scheme.name, value: `${scheme.in === 'cookie' ? `${scheme.name}=` : ''}<api-key>` };
        headers.push(header); args.push(`--header ${shellQuote(`${header.name}: ${header.value}`)}`);
      }
    } else if (scheme.type === 'basic' || scheme.scheme?.toLowerCase() === 'basic') {
      args.push(`--user ${shellQuote('<username>:<password>')}`); descriptions.push('HTTP Basic');
      headers.push({ name: 'Authorization', value: 'Basic <base64-credentials>' });
    } else if (['oauth2', 'openIdConnect'].includes(scheme.type) || scheme.scheme?.toLowerCase() === 'bearer') {
      args.push(`--header ${shellQuote('Authorization: Bearer <token>')}`); descriptions.push(name);
      headers.push({ name: 'Authorization', value: 'Bearer <token>' });
    } else descriptions.push(`${name} (${scheme.scheme ?? scheme.type}; configure credentials for this scheme)`);
  }
  return { args, query, headers, description: descriptions.join(' + ') || (security.length ? 'Optional authentication' : 'None') };
};
const parameterExample = (param: SwaggerParam): unknown => param.example
  ?? Object.values(param.examples ?? {}).find((entry) => entry.value !== undefined)?.value
  ?? param.schema?.example ?? param.schema?.default;
const buildCurl = (method: string, path: string, security: ReturnType<typeof securityDetails>, params: SwaggerParam[], bodyExample: unknown, mimeType = 'application/json', fileFields: string[] = []): { curl: string; request: ExampleRequest } => {
  const lines = [`curl --request ${method.toUpperCase()} \\`];
  const examplePath = path.replace(/\{([^}]+)\}/g, (placeholder, name) => {
    const param = params.find((p) => p.in === 'path' && p.name === name);
    const value = param && parameterExample(param);
    return value !== undefined ? encodeURIComponent(String(value)) : placeholder;
  });
  const includeParam = (p: SwaggerParam) => p.required || openapiConfig.examples.defaults === 'all' || parameterExample(p) !== undefined;
  const query = [...security.query, ...params.filter((p) => p.in === 'query' && includeParam(p)).map((p) => {
    const value = parameterExample(p);
    return `${encodeURIComponent(p.name)}=${value !== undefined ? encodeURIComponent(String(value)) : `<${p.name}>`}`;
  })];
  const url = `${API_BASE_URL}${examplePath}${query.length ? `?${query.join('&')}` : ''}`;
  const headers = [...security.headers];
  lines.push(`  --url ${shellQuote(url)} \\`);
  for (const arg of security.args) lines.push(`  ${arg} \\`);
  for (const param of params.filter((p) => p.in === 'header' && includeParam(p))) {
    lines.push(`  --header ${shellQuote(`${param.name}: ${parameterExample(param) ?? `<${param.name}>`}`)} \\`);
    headers.push({ name: param.name, value: String(parameterExample(param) ?? `<${param.name}>`) });
  }
  const body = bodyExample === undefined ? undefined : /(?:^application\/json$|\+json$)/.test(mimeType) ? JSON.stringify(bodyExample, null, 2) : mimeType === 'application/x-www-form-urlencoded' && bodyExample && typeof bodyExample === 'object' ? new URLSearchParams(Object.entries(bodyExample as Record<string, unknown>).map(([name, value]) => [name, String(value)])).toString() : typeof bodyExample === 'string' ? bodyExample : JSON.stringify(bodyExample);
  const formFields = mimeType === 'multipart/form-data' && bodyExample && typeof bodyExample === 'object' ? Object.entries(bodyExample).map(([name, value]) => ({ name, value: fileFields.includes(name) ? '<file-contents>' : typeof value === 'string' ? value : JSON.stringify(value), ...(fileFields.includes(name) ? { fileName: 'example.txt' } : {}) })) : undefined;
  if (formFields?.length) {
    formFields.forEach((field, index) => lines.push(`  --form ${shellQuote(`${field.name}=${field.fileName ? '@<path-to-file>' : field.value}`)}${index < formFields.length - 1 ? ' \\' : ''}`));
  } else if (bodyExample !== undefined) {
    lines.push(`  --header ${shellQuote(`Content-Type: ${mimeType}`)} \\`);
    headers.push({ name: 'Content-Type', value: mimeType });
    lines.push(`  --data ${shellQuote(body!)}`);
  } else {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/ \\$/, '');
  }
  return { curl: lines.join('\n'), request: { method: method.toUpperCase(), url, headers, ...(formFields ? { formFields, mimeType } : body !== undefined ? { body, mimeType } : {}) } };
};

const collectBodyProps = (schema: SwaggerSchema | undefined, spec: SwaggerSpec): NormalizedEndpoint['bodyProperties'] => {
  const resolved = resolveSchema(schema, spec);
  if (!resolved?.properties) return [];
  const required = new Set(resolved.required ?? []);
  return Object.entries(resolved.properties).map(([name, prop]) => ({
    name,
    type: prop.$ref ? 'object' : (Array.isArray(prop.type) ? prop.type.join(' | ') : prop.type ?? 'object'),
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
const mediaExample = (media?: SwaggerMedia): unknown => media?.example !== undefined ? media.example : Object.values(media?.examples ?? {}).find((entry) => entry.value !== undefined)?.value;

export const filterEndpoints = (spec: SwaggerSpec | null, section: ApiSection): NormalizedEndpoint[] => {
  if (!spec?.paths) return [];
  const result: NormalizedEndpoint[] = [];
  const globalSecurity = spec.security;
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

  for (const [path, ops] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(ops)) {
      if (!methods.includes(method.toLowerCase())) continue;
      if (!matchesSection(op, path, section)) continue;

      const pathLevel = (ops as unknown as { parameters?: SwaggerParam[] }).parameters ?? [];
      const params = [...new Map([...pathLevel, ...(op.parameters ?? [])].map((param) => [`${param.in}:${param.name}`, param])).values()];
      const pathParams = params.filter((p) => p.in === 'path');
      const queryParams = params.filter((p) => p.in === 'query');
      const headerParams = params.filter((p) => p.in === 'header' && p.name.toLowerCase() !== 'authorization');
      const bodyParam = params.find((p) => p.in === 'body');
      const requestMedia = op.requestBody?.content?.['application/json'] ?? Object.values(op.requestBody?.content ?? {})[0];
      const requestMimeType = op.requestBody?.content?.['application/json'] ? 'application/json' : Object.keys(op.requestBody?.content ?? {})[0] || 'application/json';
      const requestBodySchema = requestMedia?.schema;
      const bodySchema = bodyParam?.schema ?? requestBodySchema;
      const bodyProperties = collectBodyProps(bodySchema, spec);
      const needsAuth = requiresAuth(op, globalSecurity);
      const security = securityDetails(op, spec);
      const explicitBodyExample = mediaExample(requestMedia);
      const bodyExample = explicitBodyExample !== undefined ? explicitBodyExample : exampleForSchema(bodySchema, spec);
      const fileFields = Object.entries(resolveSchema(bodySchema, spec)?.properties || {}).filter(([, property]) => property.format === 'binary' || property.format === 'base64').map(([name]) => name);
      const { curl, request } = buildCurl(method, path, security, params, bodyExample, requestMimeType, fileFields);
      const customSamples = openapiConfig.examples.customSamples ? op['x-codeSamples'] ?? [] : [];
      if (!Array.isArray(customSamples) || customSamples.some((sample) => !sample || typeof sample.lang !== 'string' || typeof sample.source !== 'string' || !sample.source.trim())) throw new Error(`Invalid x-codeSamples for ${method} ${path}`);
      const requestExamples = generateRequestExamples(request, openapiConfig.examples.languages, curl, customSamples);

      const responses = op.responses ?? {};
      const successCode = Object.keys(responses).find((c) => c.startsWith('2')) ?? '200';
      const response = responses[successCode];
      const responseSchema = response?.schema
        ?? response?.content?.['application/json']?.schema
        ?? Object.values(response?.content ?? {})[0]?.schema;
      const responseMedia = response?.content?.['application/json'] ?? Object.values(response?.content ?? {})[0];
      const mediaResponse = mediaExample(responseMedia);
      const explicitResponse = mediaResponse !== undefined ? mediaResponse : response?.examples?.['application/json'];
      const responseExampleObj = explicitResponse !== undefined ? explicitResponse : exampleForSchema(responseSchema, spec);
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
        authDescription: security.description,
        pathParams,
        queryParams,
        headerParams,
        bodyProperties,
        curl,
        request,
        requestExamples,
        responseExample,
        successCode,
      });
    }
  }
  return result;
};
