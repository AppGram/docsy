import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dump, load } from 'js-yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { mdxParser, splitMdxFrontmatter, validateMdx } from './lib/mdx-policy.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
const markdown = unified().use(remarkParse).use(remarkStringify);
const walk = (node, visit) => { visit(node); for (const child of node.children || []) walk(child, visit); };
const cleanRoute = (value) => `/${String(value).replace(/^\/+|\/+$/g, '').replace(/\.(?:md|mdx)$/, '')}`;
const slug = (value) => cleanRoute(value).slice(1).split('/').map((part) => part.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')).join('/');

const localFile = (root, path) => {
  if (typeof path !== 'string' || !path || path.includes('\\') || /[\x00-\x1f]/.test(path)) throw new Error(`Unsafe source path: ${path}`);
  const absolute = resolve(root, path.replace(/^\//, ''));
  const rel = relative(root, absolute);
  if (rel === '..' || rel.startsWith('../') || rel.split('/').includes('.git') || rel.split('/').includes('node_modules')) throw new Error(`Source path escapes documentation: ${path}`);
  let current = root;
  for (const part of rel.split('/')) { current = resolve(current, part); if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error(`Source symlinks are not imported: ${path}`); }
  if (existsSync(absolute) && relative(realpathSync(root), realpathSync(absolute)).startsWith('..')) throw new Error(`Source path escapes documentation: ${path}`);
  return absolute;
};
const boundedRead = (file, limit = 10 * 1024 * 1024) => {
  if (!existsSync(file) || !lstatSync(file).isFile()) throw new Error(`Missing source file: ${file}`);
  if (lstatSync(file).size > limit) throw new Error(`Source file exceeds ${limit} bytes: ${file}`);
  return readFileSync(file);
};
const convertStarterComponents = (body, label) => {
  let fence = ''; let card = false; let steps = false; let step = null; let count = 0;
  const result = body.split(/\r?\n/).map((line) => {
    const indentStep = (value) => step === null || !value ? value : `   ${value.slice(Math.min(step + 2, value.match(/^ */)[0].length))}`;
    const code = line.match(/^\s*(`{3,}|~{3,})/);
    if (code) { if (!fence) fence = code[1]; else if (code[1][0] === fence[0] && code[1].length >= fence.length) fence = ''; return indentStep(line); }
    if (fence) return indentStep(line);
    const openCard = line.match(/^\s*<Card\s+((?:[a-zA-Z]+="[^"\r\n]*"\s*)+)>\s*$/);
    if (openCard) {
      if (card || steps) throw new Error(`${label}: nested cards/steps need manual conversion.`);
      const attrs = Object.fromEntries([...openCard[1].matchAll(/([a-zA-Z]+)="([^"\r\n]*)"/g)].map((m) => [m[1], m[2]]));
      if (!attrs.title || !attrs.href || Object.keys(attrs).some((key) => !['title', 'href', 'icon'].includes(key)) || /[\[\]\n]/.test(attrs.title) || /[\s()<>]/.test(attrs.href)) throw new Error(`${label}: unsupported card attributes.`);
      card = true; return `\n### [${attrs.title}](${attrs.href})\n`;
    }
    if (/^\s*<\/Card>\s*$/.test(line)) { if (!card) throw new Error(`${label}: unmatched Card.`); card = false; return ''; }
    if (/^\s*<Steps>\s*$/.test(line)) { if (steps || card) throw new Error(`${label}: nested steps need manual conversion.`); steps = true; count = 0; return ':::steps'; }
    if (/^\s*<\/Steps>\s*$/.test(line)) { if (!steps || step !== null) throw new Error(`${label}: unmatched Steps.`); steps = false; return ':::'; }
    const openStep = line.match(/^( *)<Step title="([^"\r\n]+)">\s*$/);
    if (openStep) { if (!steps || step !== null) throw new Error(`${label}: Step requires a Steps parent.`); step = openStep[1].length; return `\n${++count}. **${openStep[2].replace(/[\[\]*_]/g, '\\$&')}**\n`; }
    if (/^\s*<\/Step>\s*$/.test(line)) { if (step === null) throw new Error(`${label}: unmatched Step.`); step = null; return ''; }
    return indentStep(line);
  });
  if (card || steps || step !== null) throw new Error(`${label}: unclosed card/steps.`);
  return result.join('\n');
};

export const convertMintlifyMarkdown = (text, label) => {
  let frontmatter = {}; let body = text.replace(/^\uFEFF/, '');
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (match) { frontmatter = load(match[1]) || {}; body = body.slice(match[0].length); }
  if (typeof frontmatter !== 'object' || Array.isArray(frontmatter)) throw new Error(`${label}: invalid frontmatter.`);
  for (const field of ['title', 'description']) if (frontmatter[field] !== undefined && typeof frontmatter[field] !== 'string') throw new Error(`${label}: ${field} must be text.`);
  if (frontmatter.redirects !== undefined && (!Array.isArray(frontmatter.redirects) || frontmatter.redirects.some((value) => typeof value !== 'string'))) throw new Error(`${label}: redirects must be an array of paths.`);
  body = convertStarterComponents(body, label);
  let fence = ''; let callout = '';
  const kinds = { Note: 'note', Info: 'note', Tip: 'tip', Check: 'tip', Warning: 'warning', Danger: 'danger' };
  const lines = body.split(/\r?\n/).map((line, index) => {
    const code = line.match(/^\s*(`{3,}|~{3,})/);
    if (code) { if (!fence) fence = code[1]; else if (code[1][0] === fence[0] && code[1].length >= fence.length) fence = ''; return line; }
    if (fence) return line;
    const open = line.match(/^\s*<(Note|Info|Tip|Check|Warning|Danger)(?:\s+title="([^"\r\n]*)")?\s*>\s*$/);
    if (open) {
      if (callout) throw new Error(`${label}:${index + 1}: nested MDX callouts need manual conversion.`);
      callout = open[1]; return `:::${kinds[callout]}${open[2] ? `[${open[2].replace(/\]/g, '\\]')}]` : ''}`;
    }
    const close = line.match(/^\s*<\/(Note|Info|Tip|Check|Warning|Danger)>\s*$/);
    if (close) { if (callout !== close[1]) throw new Error(`${label}:${index + 1}: unmatched callout.`); callout = ''; return ':::'; }
    if (/^\s*(?:import\s|export\s)/.test(line)) throw new Error(`${label}:${index + 1}: unsupported MDX import/export. The importer never executes it.`);
    return line;
  });
  if (callout || fence) throw new Error(`${label}: unclosed callout/code fence.`);
  body = lines.join('\n');
  walk(markdown.parse(body), (node) => {
    if (node.type === 'html') throw new Error(`${label}:${node.position.start.line}: unsupported MDX/HTML. Convert the component explicitly; it will not be executed or discarded.`);
    if (['definition', 'linkReference', 'imageReference'].includes(node.type)) throw new Error(`${label}: reference-style links need manual conversion before migration.`);
  });
  return { frontmatter, body };
};

export const migrateMintlify = (source, target, { base = '/docs', repo = '', ci = false, format = 'mdx' } = {}) => {
  if (!['mdx', 'markdown'].includes(format)) throw new Error('Migration format must be mdx or markdown.');
  source = resolve(source); target = resolve(target);
  if (!existsSync(source) || lstatSync(source).isSymbolicLink() || !lstatSync(source).isDirectory()) throw new Error('Use a real, local Mintlify source directory.');
  if (existsSync(target)) throw new Error('Migration requires a new output directory; existing projects are never overwritten.');
  const between = relative(source, target);
  if (!between || !(between === '..' || between.startsWith('../') || posix.isAbsolute(between))) throw new Error('Output must be outside the source project.');
  const configFile = ['docs.json', 'mint.json'].find((file) => existsSync(localFile(source, file)));
  if (!configFile) throw new Error('Expected docs.json or mint.json. This migration reads local exports, never scrapes a hosted site.');
  const configBytes = boundedRead(localFile(source, configFile), 1024 * 1024);
  const original = JSON.parse(configBytes.toString('utf8'));
  const modern = original.navigation;
  if (modern?.languages || modern?.versions || original.versions) throw new Error('Export one version/locale before migrating. Multi-version navigation is not silently flattened.');
  const warnings = [];
  const pages = new Map(); const byRoute = new Map(); const assets = new Map();
  let totalAssets = 0; let totalMarkdown = 0;
  const register = (value) => {
    if (typeof value !== 'string' || !value || /^https?:/.test(value) || value.includes('#') || value.includes('?')) throw new Error(`Unsupported navigation page: ${JSON.stringify(value)}`);
    const route = cleanRoute(value);
    if (pages.has(route)) return pages.get(route);
    if (pages.size >= 2000) throw new Error('Migration is bounded to 2000 pages; export a smaller section.');
    const key = slug(value);
    if (!key || key.split('/').some((part) => !part) || [...pages.values()].some((page) => page.slug === key)) throw new Error(`Page slug collision or invalid path: ${value}`);
    const stem = route.slice(1);
    const file = [`${stem}.mdx`, `${stem}.md`, `${stem}/index.mdx`, `${stem}/index.md`].find((path) => existsSync(localFile(source, path)));
    if (!file) throw new Error(`Navigation page has no Markdown source: ${value}. OpenAPI-generated pages need the OpenAPI importer.`);
    const bytes = boundedRead(localFile(source, file));
    totalMarkdown += bytes.length;
    if (totalMarkdown > 50 * 1024 * 1024) throw new Error('Markdown import exceeds 50 MiB; export a smaller section.');
    const nativeMdx = format === 'mdx' && /\.mdx$/i.test(file);
    const converted = nativeMdx ? splitMdxFrontmatter(bytes.toString('utf8'), file) : convertMintlifyMarkdown(bytes.toString('utf8'), file);
    if (nativeMdx) validateMdx(converted.body, { label: file });
    const title = String(converted.frontmatter.title || converted.body.match(/^#\s+(.+)$/m)?.[1] || stem.split('/').at(-1));
    const page = { route, slug: key, file, extension: nativeMdx ? 'mdx' : 'md', title, description: String(converted.frontmatter.description || ''), body: converted.body, sha256: hash(bytes), frontmatter: converted.frontmatter };
    pages.set(route, page); byRoute.set(route, `/guides/${key}`);
    return page;
  };
  const item = (entry) => {
    if (typeof entry === 'string') { const page = register(entry); return { title: page.title, href: `/guides/${page.slug}` }; }
    if (entry?.href && /^https?:\/\//.test(entry.href) && (entry.label || entry.title)) return { title: entry.label || entry.title, href: entry.href };
    if (entry?.group && Array.isArray(entry.pages) && entry.pages.length) { const items = entry.pages.map(item); return { title: entry.group, href: items[0].href, items }; }
    throw new Error(`Unsupported navigation entry: ${JSON.stringify(entry)}. Export explicit Markdown pages/groups; dynamic/API navigation needs review.`);
  };
  const groups = (entries, prefix = '') => entries.map((group) => {
    if (!group.group || !Array.isArray(group.pages) || !group.pages.length) throw new Error('Expected non-empty Mintlify groups with explicit pages.');
    return { title: `${prefix}${group.group}`, items: group.pages.map(item) };
  });
  let navigation;
  if (Array.isArray(modern)) navigation = groups(modern);
  else if (Array.isArray(modern?.groups)) navigation = groups(modern.groups);
  else if (Array.isArray(modern?.pages)) navigation = groups(modern.pages);
  else if (Array.isArray(modern?.tabs)) navigation = modern.tabs.flatMap((tab) => {
    if (!tab.tab || !Array.isArray(tab.groups)) throw new Error('Only tabs containing explicit groups are supported.');
    return groups(tab.groups, `${tab.tab} / `);
  });
  else throw new Error('Expected explicit navigation groups in docs.json/mint.json.');
  if (!pages.size) throw new Error('No Markdown pages selected for migration.');
  if (pages.size > 2000) throw new Error('Migration is bounded to 2000 pages; export a smaller section.');

  const asset = (value, from = '') => {
    if (/^(?:https?:|data:|mailto:|#)/i.test(value)) return value;
    const [bare, suffix = ''] = value.split(/(?=[?#])/s, 2);
    const path = bare.startsWith('/') ? bare.slice(1) : posix.normalize(posix.join(posix.dirname(from), bare));
    const file = localFile(source, path);
    if (!assets.has(path)) {
      if (!/\.(?:png|jpe?g|svg|gif|webp|avif|ico|pdf|mp4|webm|ogv|mov|vtt)$/i.test(path)) throw new Error(`Unsupported asset format: ${path}`);
      const bytes = boundedRead(file); totalAssets += bytes.length;
      if (assets.size >= 2000 || totalAssets > 100 * 1024 * 1024) throw new Error('Asset import limit exceeded.');
      assets.set(path, bytes);
    }
    return `/assets/migrated/${path}${suffix}`;
  };
  const rewrite = (href, from, image = false) => {
    if (/^(?:https?:|mailto:|tel:|data:|#)/i.test(href)) return href;
    if (image || /\.(?:png|jpe?g|svg|gif|webp|avif|ico|pdf|mp4|webm|ogv|mov|vtt)(?:[?#]|$)/i.test(href)) return asset(href, from);
    const marker = href.search(/[?#]/); const bare = marker < 0 ? href : href.slice(0, marker); const suffix = marker < 0 ? '' : href.slice(marker);
    const route = cleanRoute(bare.startsWith('/') ? bare : posix.normalize(posix.join(posix.dirname(from), bare)));
    if (!byRoute.has(route)) throw new Error(`${from}: internal link ${href} is not in the selected navigation. Register it before migrating, rather than shipping a broken link.`);
    return `${byRoute.get(route)}${suffix}`;
  };
  const redirects = {};
  const alias = (from, to) => {
    from = cleanRoute(from);
    if (from === to) return;
    if (from === '/' || /^\/\//.test(from) || /[?#\\\x00-\x20]/.test(from) || from.split('/').some((part) => part === '..' || part === '.')) throw new Error(`Unsafe/unsupported redirect: ${from}`);
    if (redirects[from] && redirects[from] !== to) throw new Error(`Conflicting redirect: ${from}`);
    redirects[from] = to;
  };
  for (const page of pages.values()) {
    // AST positions distinguish real links from link-shaped source examples.
    // Replace only those nodes, leaving fenced and inline code byte-for-byte.
    const edits = [];
    const updateLinks = (node) => {
      let changed = false;
      for (const child of node.children || []) changed = updateLinks(child) || changed;
      if (['link', 'image'].includes(node.type)) {
        const url = rewrite(node.url, page.file, node.type === 'image');
        changed = changed || url !== node.url; node.url = url;
      }
      return changed;
    };
    const collect = (node) => {
      if (node.type === 'definition') {
        const next = structuredClone(node); next.url = rewrite(node.url, page.file);
        if (next.url !== node.url) edits.push({ start: node.position.start.offset, end: node.position.end.offset, text: markdown.stringify({ type: 'root', children: [next] }).trimEnd() });
      }
      if (node.type.startsWith('mdxJsx')) {
        for (const attribute of node.attributes || []) {
          if (['href', 'src', 'poster'].includes(attribute.name) && typeof attribute.value === 'string') {
            const next = rewrite(attribute.value, page.file, ['src', 'poster'].includes(attribute.name));
            if (next !== attribute.value) edits.push({ start: attribute.position.start.offset, end: attribute.position.end.offset, text: `${attribute.name}=${JSON.stringify(next)}` });
          }
        }
      }
      if (['link', 'image'].includes(node.type)) {
        const next = structuredClone(node);
        if (updateLinks(next)) edits.push({ start: node.position.start.offset, end: node.position.end.offset, text: markdown.stringify({ type: 'root', children: [next] }).trimEnd() });
        return; // A linked image is serialized with its parent, never overlapping edits.
      }
      for (const child of node.children || []) collect(child);
    };
    collect(page.extension === 'mdx' ? mdxParser.parse(page.body) : markdown.parse(page.body));
    for (const edit of edits.sort((a, b) => b.start - a.start)) page.body = page.body.slice(0, edit.start) + edit.text + page.body.slice(edit.end);
    alias(page.route, `/guides/${page.slug}`);
    for (const from of page.frontmatter.redirects || []) alias(from, `/guides/${page.slug}`);
  }
  for (const entry of original.redirects || []) {
    if (!entry.source || !entry.destination) throw new Error('Redirect entries require source and destination.');
    const destination = byRoute.get(cleanRoute(entry.destination));
    if (!destination) throw new Error(`Redirect destination is not an imported page: ${entry.destination}`);
    alias(entry.source, destination);
  }
  // Do not copy arbitrary directories: only referenced assets and explicitly
  // configured local logos. Fonts, scripts, credentials and orphan pages stay out.
  const logo = typeof original.logo === 'string' ? original.logo : original.logo?.light;
  const darkLogo = original.logo?.dark;
  const logoPath = logo ? asset(logo).replace(/^\//, '') : '';
  const darkPath = darkLogo ? asset(darkLogo).replace(/^\//, '') : '';
  if (original.fonts || original.font) warnings.push('Font configuration was not imported; Docsy retains its existing local font stacks.');
  if (original.api || original.openapi) warnings.push('API configuration was not converted; add the original OpenAPI file with Docsy ingestion and review endpoint navigation.');
  if (modern?.global || original.anchors || original.topbarLinks) warnings.push('Global navigation/anchors/topbar links require manual mapping to Docsy header links.');
  warnings.push(format === 'markdown' ? 'Simple Cards become linked headings; Steps become numbered steps. Review their presentation.' : 'MDX files and supported JSX components are preserved, using Docsy styling. Mintlify icon names and layout-specific props are not reproduced pixel-for-pixel.');
  warnings.push('Review custom HTML/JSX behavior, tab switching semantics, SEO settings and URL base paths. Only navigation-selected articles and referenced local assets were imported.');
  const notices = readdirSync(source).filter((name) => /^(?:LICENSE|LICENCE|NOTICE|COPYING)(?:\.[a-z0-9-]+)?$/i.test(name)).map((name) => ({ name, bytes: boundedRead(localFile(source, name), 1024 * 1024) }));
  const args = [resolve(packageRoot, 'scripts/create-docsy.mjs'), target, '--yes', '--no-install', '--name', String(original.name || 'Migrated docs'), '--base', base];
  if (repo) args.push('--repo', repo);
  if (ci) args.push('--ci');
  execFileSync(process.execPath, args, { stdio: 'pipe' });
  const yamlFile = resolve(target, 'docsy.config.yaml');
  const config = load(readFileSync(yamlFile, 'utf8'));
  config.content.mdx = { enabled: true, allowJavaScript: false, components: {} };
  config.content.articles = [...pages.values()].map((page) => ({ slug: page.slug, title: page.title, description: page.description, source: `content/migrated/${page.slug}.${page.extension}` }));
  config.navigation = navigation; config.redirects = redirects;
  config.ingestion.openapi.enabled = false;
  if (logoPath) config.site.logo = logoPath;
  if (darkPath) config.site.logoDark = darkPath;
  config.home.title = original.name || 'Documentation';
  config.home.primaryAction = { label: 'Read documentation', href: config.navigation[0].items[0].href };
  for (const page of pages.values()) { const file = resolve(target, `content/migrated/${page.slug}.${page.extension}`); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, page.body); }
  for (const [path, bytes] of assets) { const file = resolve(target, `public/assets/migrated/${path}`); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, bytes); }
  writeFileSync(yamlFile, dump(config, { noRefs: true, lineWidth: 120 }));
  // Keep upstream notices alongside converted content, never replace Docsy's license.
  for (const { name, bytes } of notices) { const file = resolve(target, 'migration/upstream', name); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, bytes); }
  const report = { schemaVersion: 1, platform: 'mintlify', format, sourceConfig: configFile, configSha256: hash(configBytes), pages: [...pages.values()].map(({ route, slug, file, extension, sha256 }) => ({ route, slug, file, extension, sha256 })), assets: [...assets].map(([path, bytes]) => ({ path, sha256: hash(bytes) })), redirects, warnings, published: false };
  report.notices = notices.map(({ name, bytes }) => ({ path: `migration/upstream/${name}`, sha256: hash(bytes) }));
  mkdirSync(resolve(target, 'migration'), { recursive: true });
  writeFileSync(resolve(target, 'migration/report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Imported ${pages.size} articles and ${assets.size} assets; ${Object.keys(redirects).length} redirects. Review migration/report.json, then run npm install, npm run validate and npm run build. Nothing was published.`);
  return report;
};

export const main = (args) => {
  if (args[0] !== 'mintlify') throw new Error('Usage: docsy migrate mintlify --source <local-export> --out <new-directory> [--format mdx|markdown] [--base /docs] [--repo https://github.com/OWNER/REPO] [--ci]');
  const options = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--ci') { options.ci = true; continue; }
    if (!['--source', '--out', '--base', '--repo', '--format'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Invalid migration option: ${args[i]}`);
    options[args[i].slice(2)] = args[++i];
  }
  if (!options.source || !options.out) throw new Error('Provide --source and --out. Source exports are never modified.');
  return migrateMintlify(options.source, options.out, options);
};
