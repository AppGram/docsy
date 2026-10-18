import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { docsPath, docsyConfig, isServer } from '../src/config';
import { extractHtml } from '../src/lib/html-content';
if (isServer || !docsyConfig.validation.links) process.exit(0);
const root = resolve(process.cwd(), 'dist');
const files: string[] = [];
const walk = (dir: string) => { for (const entry of readdirSync(dir, { withFileTypes: true })) { const path = resolve(dir, entry.name); if (entry.isDirectory()) walk(path); else if (entry.isFile() && path.endsWith('.html')) files.push(path); } };
walk(root);
const errors: string[] = [];
const cache = new Map<string, ReturnType<typeof extractHtml>>();
const html = (file: string) => { if (!cache.has(file)) cache.set(file, extractHtml(readFileSync(file, 'utf8'))); return cache.get(file)!; };
for (const file of files) {
  const path = `/${relative(root, file).split('\\').join('/')}`;
  const route = docsPath(path.replace(/index\.html$/, ''));
  const base = `${docsyConfig.site.origin}${route.endsWith('/') ? route : `${route}/`}`;
  for (const href of html(file).links) {
    if (!href || href === '#' || /^(?:mailto:|tel:|data:)/i.test(href)) continue;
    let url: URL;
    try { url = new URL(href, base); } catch { errors.push(`${route}: invalid link ${href}`); continue; }
    if (url.origin !== new URL(docsyConfig.site.origin).origin) continue;
    const mount = docsPath(); const pathname = decodeURIComponent(url.pathname);
    if (mount !== '/' && pathname !== mount && !pathname.startsWith(`${mount}/`)) continue;
    const targetPath = mount === '/' ? pathname : pathname.slice(mount.length);
    let target = resolve(root, `.${targetPath || '/'}`);
    if (!target.startsWith(`${root}/`) && target !== root) { errors.push(`${route}: link escapes output ${href}`); continue; }
    if (existsSync(target) && statSync(target).isDirectory()) target = resolve(target, 'index.html');
    if (!existsSync(target)) { errors.push(`${route}: missing built target ${href}`); continue; }
    if (url.hash && extname(target) === '.html' && !html(target).ids.has(decodeURIComponent(url.hash.slice(1)))) errors.push(`${route}: missing built anchor ${href}`);
  }
}
if (errors.length) throw new Error(`Built-site link validation failed:\n${[...new Set(errors)].map((error) => `- ${error}`).join('\n')}`);
console.log(`Checked links and anchors in ${files.length} generated HTML pages.`);
