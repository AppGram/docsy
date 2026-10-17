import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = process.cwd();
const serverEntry = resolve(root, 'dist/server/entry.mjs');

if (existsSync(serverEntry)) {
  await import(serverEntry);
} else {
  const staticRoot = resolve(root, 'release');
  const port = Number(process.env.PORT) || 8080;
  const host = process.env.HOST || '0.0.0.0';
  const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };

  createServer((request, response) => {
    let pathname = '/';
    try {
      pathname = decodeURIComponent(new URL(request.url || '/', 'http://docsy.local').pathname);
    } catch {
      response.writeHead(400).end('Bad request');
      return;
    }

    const relative = normalize(pathname).replace(/^(?:\.\.(?:\/|\\|$))+/, '').replace(/^[/\\]+/, '');
    let file = join(staticRoot, relative);
    if (!file.startsWith(staticRoot)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');

    if (!existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }

    const extension = extname(file).toLowerCase();
    const isMarkdownExport = pathname.includes('/format-md/');
    const headers = {
      'Content-Type': isMarkdownExport
        ? 'text/markdown; charset=utf-8'
        : contentTypes[extension] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    };
    if (pathname.includes('/_astro/')) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    createReadStream(file).on('error', () => response.destroy()).pipe(response.writeHead(200, headers));
  }).listen(port, host, () => {
    console.log(`Docsy listening on http://${host}:${port}`);
  });
}
