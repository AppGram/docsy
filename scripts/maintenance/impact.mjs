import { load } from 'js-yaml';

const methods = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

const canonical = (value) => JSON.stringify(sort(value));
const sort = (value) => Array.isArray(value) ? value.map(sort)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sort(value[key])])) : value;

const resolveRefs = (value, root, seen = new Set()) => {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => resolveRefs(item, root, seen));
  if (typeof value.$ref === 'string' && value.$ref.startsWith('#/') && !seen.has(value.$ref)) {
    const target = value.$ref.slice(2).split('/').reduce((node, part) => node?.[part.replace(/~1/g, '/').replace(/~0/g, '~')], root);
    if (target) {
      const { $ref, ...siblings } = value;
      return resolveRefs({ ...target, ...siblings }, root, new Set([...seen, $ref]));
    }
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveRefs(item, root, seen)]));
};

const structural = (value) => {
  if (Array.isArray(value)) return value.map(structural);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['description', 'summary', 'title', 'example', 'examples', 'externalDocs'].includes(key))
    .map(([key, item]) => [key, structural(item)]));
};

const operations = (text) => {
  if (!text) return new Map();
  const root = load(text);
  if (!root || typeof root !== 'object' || (!root.openapi && !root.swagger)) {
    throw new Error('The configured OpenAPI input is not an OpenAPI or Swagger document.');
  }
  const result = new Map();
  for (const [path, rawPathItem] of Object.entries(root.paths ?? {})) {
    const pathItem = resolveRefs(rawPathItem, root);
    for (const [method, rawOperation] of Object.entries(pathItem ?? {})) {
      if (!methods.has(method) || !rawOperation || typeof rawOperation !== 'object') continue;
      const operation = resolveRefs(rawOperation, root);
      const parameters = new Map();
      for (const parameter of [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])]) {
        parameters.set(`${parameter.in}:${parameter.name}`, parameter);
      }
      result.set(`${method.toUpperCase()} ${path}`, {
        path, method: method.toUpperCase(), operationId: operation.operationId,
        parameters: [...parameters.values()],
        requestBody: operation.requestBody ?? null,
        responses: operation.responses ?? {},
        security: operation.security ?? root.security ?? [],
        servers: operation.servers ?? pathItem.servers ?? root.servers ?? { host: root.host, basePath: root.basePath, schemes: root.schemes },
        copy: { summary: operation.summary, description: operation.description, tags: operation.tags, deprecated: operation.deprecated },
      });
    }
  }
  return result;
};

export const compareOpenApi = (before, after) => {
  const previous = operations(before);
  const current = operations(after);
  const changes = [];
  const add = (operation, kind, detail, severity, extra = {}) => changes.push({
    endpoint: `${operation.method} ${operation.path}`, path: operation.path,
    operationId: operation.operationId ?? null, kind, detail, severity, ...extra,
  });
  for (const [key, old] of previous) {
    const next = current.get(key);
    if (!next) { add(old, 'removed-operation', 'Endpoint removed; callers and examples must migrate.', 'breaking'); continue; }
    const oldParams = new Map(old.parameters.map((item) => [`${item.in}:${item.name}`, item]));
    const newParams = new Map(next.parameters.map((item) => [`${item.in}:${item.name}`, item]));
    for (const [name, parameter] of newParams) {
      const prior = oldParams.get(name);
      if (!prior) add(next, 'added-parameter', `${parameter.required ? 'Required' : 'Optional'} ${parameter.in} parameter added: ${parameter.name}.`,
        parameter.required ? 'breaking' : 'additive', { parameter: parameter.name });
      else if (!prior.required && parameter.required) add(next, 'required-parameter', `${parameter.in} parameter is now required: ${parameter.name}.`, 'breaking', { parameter: parameter.name });
      else if (canonical(structural(prior)) !== canonical(structural(parameter))) add(next, 'changed-parameter', `${parameter.in} parameter changed: ${parameter.name}. Check accepted values and examples.`, 'review', { parameter: parameter.name });
    }
    for (const [name, parameter] of oldParams) {
      if (!newParams.has(name)) add(next, 'removed-parameter', `${parameter.in} parameter removed: ${parameter.name}. Check callers that still send it.`, 'review', { parameter: parameter.name });
    }
    for (const [field, kind, detail] of [
      ['requestBody', 'changed-request', 'Request body changed. Check required fields, types, and examples.'],
      ['responses', 'changed-response', 'Response contract changed. Check response fields and status codes.'],
      ['security', 'changed-security', 'Authentication requirements changed.'],
      ['servers', 'changed-server', 'Request server or base URL changed.'],
    ]) {
      if (canonical(structural(old[field])) !== canonical(structural(next[field]))) add(next, kind, detail, 'review');
    }
    if (canonical(old) !== canonical(next) && !changes.some((change) => change.endpoint === key)) {
      add(next, 'changed-reference', 'Description, examples, identifier, tags, or other reference metadata changed.', 'documentation');
    }
  }
  for (const [key, next] of current) {
    if (!previous.has(key)) add(next, 'added-operation', 'Endpoint added; consider onboarding and usage examples.', 'additive');
  }
  return changes;
};

const mentionsPath = (text, path) => {
  if (text.includes(path)) return true;
  const expression = path.split(/(\{[^}]+\})/g).map((part) => part.startsWith('{')
    ? '[^/\\s?"\x27`)]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
  return new RegExp(expression).test(text);
};

export const findDocImpact = (articles, apiChanges, codeSymbols, sourceFiles) => articles.map((article) => {
  const reasons = [];
  const staleExamples = [];
  const fences = [...article.text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((match) => match[1]);
  for (const change of apiChanges) {
    if (!mentionsPath(article.text, change.path) && !(change.operationId && article.text.includes(change.operationId))) continue;
    reasons.push(`${change.endpoint}: ${change.detail}`);
    for (const fence of fences) {
      if (!mentionsPath(fence, change.path) && !(change.operationId && fence.includes(change.operationId))) continue;
      if (change.kind === 'removed-operation') staleExamples.push(`Example references removed endpoint ${change.endpoint}.`);
      if (['added-parameter', 'required-parameter'].includes(change.kind) && change.severity === 'breaking' && !fence.includes(change.parameter)) {
        staleExamples.push(`Example for ${change.endpoint} may omit required parameter ${change.parameter}.`);
      }
      if (['changed-request', 'changed-response', 'changed-parameter', 'changed-security', 'changed-server', 'removed-parameter'].includes(change.kind)) {
        staleExamples.push(`Review example for ${change.endpoint}: ${change.detail}`);
      }
    }
  }
  for (const symbol of codeSymbols) {
    if (article.text.includes(symbol)) reasons.push(`References changed code symbol ${symbol}.`);
  }
  for (const source of sourceFiles) {
    if (article.text.includes(source)) reasons.push(`References changed source ${source}.`);
  }
  return { path: article.path, reasons: [...new Set(reasons)], staleExamples: [...new Set(staleExamples)] };
}).filter((article) => article.reasons.length > 0);

export const symbolsFromDiff = (diff) => [...new Set([...diff.matchAll(/^[+-](?![+-]).*?\b(?:function|class|interface|type|enum|const|let|def|func|struct)\s+([A-Za-z_$][\w$]*)/gm)]
  .map((match) => match[1]).filter((symbol) => symbol.length > 2))].slice(0, 100);
