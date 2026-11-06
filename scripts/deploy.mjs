// `docsy deploy`: build an open-mode site for /developers and publish it to
// AppGram's hosted docs. Uses only Node built-ins (fetch, crypto, fs).
//
//   APPGRAM_API_KEY=... docsy deploy --project <id> [--no-build] [--message <text>] [--no-activate]
//
// Flow: GET site (portal URL) -> build with basePath /developers -> hash
// release/developers -> POST deploy (API answers which blobs it lacks) ->
// PUT those blobs (8 at a time, retried) -> finalize -> print the live URL.

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, dump } from 'js-yaml';

export const BASE_PATH = '/developers';
export const LIMITS = { files: 5000, totalBytes: 200 * 1024 * 1024, fileBytes: 25 * 1024 * 1024 };
export const LOCKED_MESSAGE = 'AppGram hosting serves open (static) Docsy sites only. This site uses access.mode: locked or agent.query: true, which needs a Node server. Permission-gated hosted docs are coming; deploy in open mode or self-host locked mode (see Self-host Docsy).';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.yaml': 'application/yaml; charset=utf-8',
  '.yml': 'application/yaml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.zip': 'application/zip',
  '.drawio': 'application/xml; charset=utf-8',
  '.puml': 'text/plain; charset=utf-8',
  '.plantuml': 'text/plain; charset=utf-8',
};

export const contentType = (path) => CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';

export const parseArgs = (args) => {
  const options = { project: '', build: true, activate: true, message: '' };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = () => {
      const next = args[++i];
      if (next === undefined || next.startsWith('--')) throw new Error(`${arg} needs a value`);
      return next;
    };
    if (arg === '--project') options.project = value();
    else if (arg.startsWith('--project=')) options.project = arg.slice(10);
    else if (arg === '--message' || arg === '-m') options.message = value();
    else if (arg.startsWith('--message=')) options.message = arg.slice(10);
    else if (arg === '--no-build') options.build = false;
    else if (arg === '--no-activate') options.activate = false;
    else throw new Error(`Unknown deploy option: ${arg}`);
  }
  if (!options.project) throw new Error('Usage: docsy deploy --project <projectId> [--no-build] [--message <text>] [--no-activate]');
  return options;
};

const interpolateEnv = (value, env) => value.replace(/\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/g, (_, key, fallback = '') => {
  const resolved = env[key] ?? fallback;
  if (!resolved) throw new Error(`Docsy configuration requires environment variable ${key}`);
  return resolved;
});

export const configPath = (root, env = process.env) => resolve(root, env.DOCSY_CONFIG || 'docsy.config.yaml');

// Same reading as astro.config.mjs: env placeholders expanded, then YAML.
export const readConfig = (file, env = process.env) => load(interpolateEnv(readFileSync(file, 'utf8'), env)) || {};

export const isLocked = (config) => config?.access?.mode === 'locked' || config?.agent?.query === true;

export const assertOpenMode = (config) => {
  if (isLocked(config)) throw new Error(LOCKED_MESSAGE);
};

// Copy of the project's config with basePath forced to /developers and the
// origin pointed at the portal (when known). Placeholders stay unexpanded so
// the build expands them exactly as before.
export const deployConfig = (rawText, { origin } = {}) => {
  const config = load(rawText) || {};
  config.site = config.site || {};
  const oldBase = `/${String(config.site.basePath || '/').replace(/^\/+|\/+$/g, '')}`;
  config.site.basePath = BASE_PATH;
  if (origin) config.site.origin = origin;
  const home = config.site.homeUrl;
  if (home === undefined || home === oldBase || home === `${oldBase}/` || home === '/') config.site.homeUrl = `${BASE_PATH}/`;
  return dump(config, { lineWidth: -1, noRefs: true });
};

// Dotfiles (.env, .git, .nojekyll, editor files) are never published, only
// skipped; .well-known is the one exception.
const isHidden = (name) => name.startsWith('.') && name !== '.well-known';

const walk = (dir, prefix, out, where = 'build output') => {
  for (const name of readdirSync(dir).sort()) {
    const absolute = join(dir, name);
    const path = prefix ? `${prefix}/${name}` : name;
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Refusing symlink in ${where}: ${path}`);
    if (isHidden(name)) continue;
    if (stat.isDirectory()) walk(absolute, path, out);
    else if (stat.isFile()) out.push({ path, absolute, size: stat.size });
  }
  return out;
};

// The build copies public/ with symlinks followed, so a link such as
// public/x -> ../.env would land in the output as an ordinary file. Check the
// source before building.
export const assertSafePublicDir = (root) => {
  const dir = resolve(root, 'public');
  if (existsSync(dir)) walk(dir, 'public', [], 'public/');
};

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// files: [{path, sha256, size, content_type}] sorted by path; paths relative
// to the /developers mount with "/" separators. Throws on contract limits.
export const buildManifest = (outputDir) => {
  if (!existsSync(outputDir)) throw new Error(`No static output at ${outputDir}. Run without --no-build, or build with site.basePath ${BASE_PATH}.`);
  const entries = walk(outputDir, '', []);
  if (entries.length === 0) throw new Error(`Static output ${outputDir} is empty.`);
  if (entries.length > LIMITS.files) throw new Error(`Build has ${entries.length} files; hosted docs allow ${LIMITS.files}.`);
  let total = 0;
  const files = entries.map((entry) => {
    if (entry.size > LIMITS.fileBytes) throw new Error(`${entry.path} is ${mb(entry.size)}; hosted docs allow ${mb(LIMITS.fileBytes)} per file.`);
    total += entry.size;
    return { path: entry.path, sha256: sha256(readFileSync(entry.absolute)), size: entry.size, content_type: contentType(entry.path), absolute: entry.absolute };
  });
  if (total > LIMITS.totalBytes) throw new Error(`Build is ${mb(total)}; hosted docs allow ${mb(LIMITS.totalBytes)} per deploy.`);
  if (!files.some((file) => file.path === 'index.html')) throw new Error(`Static output has no index.html at ${outputDir}.`);
  return { files, totalBytes: total };
};

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.status = status; this.code = code; this.details = details;
  }
}

const retryable = (status) => status >= 500 || status === 429;

// fetch with retries on network errors, 429 and 5xx (exponential backoff).
export const fetchRetry = async (url, init, { attempts = 4, delay = 500, fetchImpl = globalThis.fetch } = {}) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetchImpl(url, init);
      if (!retryable(response.status) || attempt === attempts) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    }
    await sleep(delay * 2 ** (attempt - 1));
  }
  throw lastError;
};

export const createClient = ({ apiUrl, apiKey, fetchImpl = globalThis.fetch, retryDelay = 500 }) => {
  const base = apiUrl.replace(/\/+$/, '');
  const call = async (method, path, body) => {
    let response;
    try {
      response = await fetchRetry(`${base}${path}`, {
        method,
        headers: { 'x-api-key': apiKey, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        // Never follow a redirect: fetch would resend x-api-key to the new host.
        redirect: 'error',
      }, { fetchImpl, delay: retryDelay });
    } catch (error) {
      throw new ApiError(`Could not reach ${base}: ${error.message}`);
    }
    const text = await response.text();
    let envelope = null;
    try { envelope = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    if (!response.ok || envelope?.success === false) {
      const error = envelope?.error;
      const message = (typeof error === 'string' ? error : error?.message) || envelope?.message || `${method} ${path} failed with HTTP ${response.status}`;
      throw new ApiError(message, { status: response.status, code: error?.code, details: error?.details });
    }
    return envelope?.data ?? envelope;
  };
  return {
    getSite: (project) => call('GET', `/api/v1/projects/${encodeURIComponent(project)}/docs`),
    createDeploy: (project, body) => call('POST', `/api/v1/projects/${encodeURIComponent(project)}/docs/deploys`, body),
    finalize: (project, deployId, activate) => call('POST', `/api/v1/projects/${encodeURIComponent(project)}/docs/deploys/${encodeURIComponent(deployId)}/finalize`, { activate }),
  };
};

// Runs worker(item) over items, at most `limit` at a time; first error wins.
export const pool = async (items, limit, worker) => {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  });
  await Promise.all(runners);
};

export const uploadBlobs = async (uploads, files, { fetchImpl = globalThis.fetch, concurrency = 8, retryDelay = 500, onProgress = () => {} } = {}) => {
  const bySha = new Map(files.map((file) => [file.sha256, file]));
  let done = 0;
  await pool(uploads, concurrency, async (upload) => {
    const file = bySha.get(upload.sha256);
    if (!file) throw new Error(`API asked for an unknown blob ${upload.sha256}`);
    const response = await fetchRetry(upload.url, {
      method: upload.method || 'PUT',
      headers: upload.headers || { 'Content-Type': file.content_type },
      body: readFileSync(file.absolute),
    }, { fetchImpl, delay: retryDelay });
    if (!response.ok) throw new Error(`Upload of ${file.path} failed with HTTP ${response.status}`);
    onProgress(++done, uploads.length);
  });
};

const gitSha = (root, env) => {
  if (env.GITHUB_SHA) return env.GITHUB_SHA;
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
};

const docsyVersion = (root, ownRoot) => {
  const manifest = resolve(root, '.docsy/template.json');
  try {
    if (existsSync(manifest)) return JSON.parse(readFileSync(manifest, 'utf8')).templateVersion || '';
    return JSON.parse(readFileSync(resolve(ownRoot, 'package.json'), 'utf8')).version || '';
  } catch { return ''; }
};

export const deploy = async (args, {
  root = process.cwd(),
  ownRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  env = process.env,
  fetchImpl = globalThis.fetch,
  build = (configFile) => {
    // The key stays out of the build: config placeholders and build plugins
    // can read any environment variable.
    const { APPGRAM_API_KEY: _key, ...buildEnv } = env;
    const result = spawnSync(process.execPath, [resolve(ownRoot, 'scripts/docsy.mjs'), 'build'], { cwd: root, env: { ...buildEnv, DOCSY_CONFIG: configFile }, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('Docsy build failed; nothing was deployed.');
  },
  log = console.log,
  retryDelay = 500,
} = {}) => {
  const options = parseArgs(args);
  const apiKey = env.APPGRAM_API_KEY;
  if (!apiKey) throw new Error('Set APPGRAM_API_KEY to an AppGram API key with the help_center:manage scope.');
  const apiUrl = env.APPGRAM_API_URL || 'https://api.appgram.dev';
  const { protocol, hostname } = new URL(apiUrl);
  if (protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
    throw new Error(`APPGRAM_API_URL must use https (got ${protocol}//${hostname}).`);
  }

  const sourceConfig = configPath(root, env);
  if (!existsSync(sourceConfig)) throw new Error(`No Docsy configuration at ${sourceConfig}.`);
  const config = readConfig(sourceConfig, env);
  assertOpenMode(config);

  const client = createClient({ apiUrl, apiKey, fetchImpl, retryDelay });
  const site = await client.getSite(options.project);
  const origin = site?.url ? new URL(site.url).origin : undefined;

  if (options.build) {
    assertSafePublicDir(root);
    const tempConfig = resolve(root, '.docsy/deploy/docsy.config.yaml');
    mkdirSync(dirname(tempConfig), { recursive: true });
    for (const dir of [resolve(root, '.docsy'), dirname(tempConfig)]) {
      if (lstatSync(dir).isSymbolicLink()) throw new Error(`Refusing symlinked ${dir}.`);
    }
    writeFileSync(tempConfig, deployConfig(readFileSync(sourceConfig, 'utf8'), { origin }));
    log(`Building for ${BASE_PATH}${origin ? ` on ${origin}` : ''}...`);
    build(tempConfig);
  } else if (`/${String(config?.site?.basePath || '/').replace(/^\/+|\/+$/g, '')}` !== BASE_PATH) {
    throw new Error(`--no-build needs a build made with site.basePath ${BASE_PATH} (this config has ${config?.site?.basePath || '/'}).`);
  }

  const outputDir = resolve(root, 'release', BASE_PATH.slice(1));
  const { files, totalBytes } = buildManifest(outputDir);
  log(`Hashed ${files.length} files (${mb(totalBytes)}).`);

  const created = await client.createDeploy(options.project, {
    files: files.map(({ path, sha256: hash, size, content_type }) => ({ path, sha256: hash, size, content_type })),
    base_path: BASE_PATH,
    docsy_version: docsyVersion(root, ownRoot) || undefined,
    commit_sha: gitSha(root, env) || undefined,
    message: options.message || undefined,
    source: env.GITHUB_ACTIONS === 'true' ? 'github' : 'cli',
  });
  const deployId = created?.deploy?.id;
  if (!deployId) throw new Error('The API did not return a deploy id.');
  const uploads = created.uploads || [];
  log(uploads.length ? `Uploading ${uploads.length} new files...` : 'All files already uploaded.');
  await uploadBlobs(uploads, files, { fetchImpl, retryDelay, onProgress: (n, total) => { if (n === total || n % 50 === 0) log(`  ${n}/${total}`); } });

  let finalized;
  try {
    finalized = await client.finalize(options.project, deployId, options.activate);
  } catch (error) {
    if (error.status === 409) {
      const missing = [].concat(error.details?.missing ?? error.details ?? []).slice(0, 20);
      throw new ApiError(`${error.message}${missing.length ? `\nMissing blobs:\n  ${missing.join('\n  ')}` : ''}\nRun docsy deploy again to upload them.`, error);
    }
    throw error;
  }

  const after = options.activate ? await client.getSite(options.project).catch(() => null) : null;
  const url = after?.url || site?.url || null;
  if (options.activate) log(`Deployed ${deployId}${url ? `: ${url}` : '.'}`);
  else log(`Uploaded ${deployId} without activating it. Activate it from the AppGram dashboard or the activate API.`);
  return { deploy: finalized?.deploy ?? finalized, url };
};

export const main = async (args) => {
  try {
    await deploy(args);
  } catch (error) {
    console.error(`docsy deploy: ${error.message}`);
    process.exitCode = 1;
  }
};
