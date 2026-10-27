import { docsPath, docsyConfig, parseDocsPath } from '../config';

export type AccessIdentity = {
  authenticated: boolean;
  tiers: string[];
  subject?: string;
};

export type AccessRule = (typeof docsyConfig.access.rules)[number];

export type AccessDecision = {
  allowed: boolean;
  identity: AccessIdentity;
  rule?: AccessRule;
  requiredTiers: string[];
};

const anonymousIdentity = (): AccessIdentity => ({ authenticated: false, tiers: [] });

const splitTiers = (value: unknown): string[] => {
  const source = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\s,]+/) : [];
  return [...new Set(source.filter((tier): tier is string => typeof tier === 'string' && tier.length > 0))];
};

const globToRegExp = (pattern: string): RegExp => {
  let source = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '*' && pattern[index + 1] === '*') {
      source += '.*';
      index += 1;
    } else if (character === '*') {
      source += '[^/]*';
    } else {
      source += character.replace(/[|\\{}()[\]^$+?.-]/g, '\\$&');
    }
  }
  return new RegExp(`${source}$`);
};

const compiledRules = docsyConfig.access.rules.map((rule) => ({
  rule,
  matcher: globToRegExp(rule.pattern),
}));

export const accessRuleForPath = (path: string): AccessRule | undefined => {
  const canonical = parseDocsPath(docsPath(path))?.path ?? path;
  return compiledRules.find(({ matcher }) => matcher.test(path) || matcher.test(canonical))?.rule;
};

export const relativeDocsPath = (pathname: string): string | null => {
  const base = docsPath();
  if (base === '/') return pathname || '/';
  if (pathname === base || pathname === `${base}/`) return '/';
  if (!pathname.startsWith(`${base}/`)) return null;
  return pathname.slice(base.length) || '/';
};

export const accessPathForRequest = (relativePath: string): string => {
  const markdownMatch = relativePath.match(/^\/format-md\/(.+)$/);
  const jsonMatch = relativePath.match(/^\/agent\/pages\/(.+)\.json$/);
  const rawTarget = markdownMatch?.[1] ?? jsonMatch?.[1];
  if (!rawTarget) return relativePath;
  let target: string;
  try { target = decodeURIComponent(rawTarget).replace(/\/+$/, ''); } catch { return relativePath; }
  if (markdownMatch) target = target.replace(/\.md$/, '');
  if (target === 'index') return '/';
  return /^versions\/[^/]+\/[^/]+\/index$/.test(target) ? `/${target.slice(0, -6)}` : `/${target}`;
};

export const canAccessPath = (path: string, tiers: string[]): boolean => {
  if (docsyConfig.access.mode === 'open') return true;
  const rule = accessRuleForPath(path);
  if (!rule) return true;
  return rule.tiers.some((tier) => tiers.includes(tier));
};

export const evaluateAccess = (path: string, identity: AccessIdentity): AccessDecision => {
  const rule = accessRuleForPath(path);
  return {
    allowed: !rule || rule.tiers.some((tier) => identity.tiers.includes(tier)),
    identity,
    rule,
    requiredTiers: rule?.tiers ?? [],
  };
};

const identityFromHeader = (request: Request): AccessIdentity => {
  const provider = docsyConfig.access.provider;
  if (provider.type !== 'header') return anonymousIdentity();
  const tiers = splitTiers(request.headers.get(provider.tierHeader));
  const subject = provider.userHeader ? request.headers.get(provider.userHeader) ?? undefined : undefined;
  return { authenticated: Boolean(subject || tiers.length), tiers, subject };
};

const identityFromWebhook = async (request: Request, path: string): Promise<AccessIdentity> => {
  const provider = docsyConfig.access.provider;
  if (provider.type !== 'webhook') return anonymousIdentity();

  const headers = new Headers({ accept: 'application/json' });
  for (const header of provider.forwardHeaders) {
    const value = request.headers.get(header);
    if (value) headers.set(header, value);
  }
  headers.set(provider.pathHeader, path);

  const options: RequestInit = {
    method: provider.method,
    headers,
    signal: AbortSignal.timeout(provider.timeoutMs),
  };
  if (provider.method === 'POST') {
    headers.set('content-type', 'application/json');
    options.body = JSON.stringify({ path });
  }

  try {
    const response = await fetch(provider.endpoint, options);
    if (!response.ok) return anonymousIdentity();
    const payload = await response.json() as {
      authenticated?: boolean;
      tiers?: string[] | string;
      subject?: string;
      user?: { id?: string };
    };
    const tiers = splitTiers(payload.tiers);
    const subject = payload.subject ?? payload.user?.id;
    return {
      authenticated: payload.authenticated ?? Boolean(subject || tiers.length),
      tiers,
      subject,
    };
  } catch {
    // Permission checks fail closed; public routes remain available because
    // they have no matching rule.
    return anonymousIdentity();
  }
};

export const resolveAccessIdentity = async (request: Request, path: string): Promise<AccessIdentity> => {
  if (docsyConfig.access.mode === 'open') return anonymousIdentity();
  return docsyConfig.access.provider.type === 'header'
    ? identityFromHeader(request)
    : identityFromWebhook(request, path);
};

export const tierDetails = (ids: string[]) => ids.map((id) => ({
  id,
  label: docsyConfig.access.tiers[id]?.label ?? id,
  description: docsyConfig.access.tiers[id]?.description,
}));
