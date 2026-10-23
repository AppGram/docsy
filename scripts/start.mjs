import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { byteRange } from './lib/http-range.mjs';

const root = process.cwd();
const serverEntry = resolve(root, 'dist/server/entry.mjs');

if (existsSync(serverEntry)) {
  await import(pathToFileURL(serverEntry).href);
} else {
  const staticRoot = resolve(root, 'release');
  const port = Number(process.env.PORT) || 8080;
  const host = process.env.HOST || '0.0.0.0';
  const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.avif': 'image/avif',
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
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogv': 'video/ogg',
    '.mov': 'video/quicktime',
    '.vtt': 'text/vtt; charset=utf-8',
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
      const errorPage = join(staticRoot, '404.html');
      const isDocument = !/\.[^/]+$/.test(pathname) && !/\/(?:agent|format-md)(?:\/|$)/.test(pathname);
      if (isDocument && existsSync(errorPage)) {
        response.writeHead(404, {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
          'Content-Length': statSync(errorPage).size,
          'Cache-Control': 'no-store',
        });
        if (request.method === 'HEAD') { response.end(); return; }
        const stream = createReadStream(errorPage);
        response.once('close', () => stream.destroy());
        stream.on('error', () => response.destroy()).pipe(response);
        return;
      }
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }

    const extension = extname(file).toLowerCase();
    const isMarkdownExport = pathname.includes('/format-md/');
    const size = statSync(file).size;
    const headers = {
      'Content-Type': isMarkdownExport
        ? 'text/markdown; charset=utf-8'
        : contentTypes[extension] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
      'Content-Length': size,
    };
    if (pathname.includes('/_astro/')) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    // HEAD describes the full resource; Range is defined for GET requests.
    if (request.method === 'HEAD') { response.writeHead(200, headers).end(); return; }
    const range = request.method === 'GET' ? byteRange(request.headers.range, size) : null;
    if (range === 'unsatisfiable') {
      response.writeHead(416, { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': 0 }).end(); return;
    }
    if (range) {
      headers['Content-Length'] = range.end - range.start + 1;
      headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`;
    }
    const stream = createReadStream(file, range || undefined);
    response.once('close', () => stream.destroy());
    stream.on('error', () => response.destroy()).pipe(response.writeHead(range ? 206 : 200, headers));
  }).listen(port, host, () => {
    console.log(`Docsy listening on http://${host}:${port}`);
  });
}
