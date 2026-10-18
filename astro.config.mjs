import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { load } from 'js-yaml';

const configPath = resolve(process.cwd(), process.env.DOCSY_CONFIG || 'docsy.config.yaml');
const interpolateEnv = (value) => value.replace(/\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/g, (_, key, fallback = '') => {
  const resolved = process.env[key] ?? fallback;
  if (!resolved) throw new Error(`Docsy configuration requires environment variable ${key}`);
  return resolved;
});
const raw = load(interpolateEnv(readFileSync(configPath, 'utf8'))) || {};
const base = raw?.site?.basePath || '/';
const site = raw?.site?.origin;
const locked = raw?.access?.mode === 'locked' || raw?.agent?.query === true;

export default defineConfig({
  base,
  site,
  output: locked ? 'server' : 'static',
  adapter: locked ? node({ mode: 'standalone' }) : undefined,
  // Per-project cache also keeps isolated generated-site tests from racing when
  // they intentionally share a read-only dependency installation.
  vite: { cacheDir: resolve(process.cwd(), '.astro/vite') },
  server: {
    port: Number(process.env.PORT) || 4321,
    host: true,
  },
});
