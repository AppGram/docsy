// Vendored assets: no runtime CDN requests, fonts, or tracking.
import { mkdirSync, writeFileSync } from 'node:fs';
const revision = '6a37858047b0e8d9c9c0e68f4a071fc410652e89';
const base = `https://raw.githubusercontent.com/devicons/devicon/${revision}`;
const selected = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const names = {
  swift: 'swift/swift-original.svg', dart: 'dart/dart-original.svg',
  typescript: 'typescript/typescript-original.svg', javascript: 'javascript/javascript-original.svg',
  python: 'python/python-original.svg', rust: 'rust/rust-original.svg',
  csharp: 'csharp/csharp-original.svg', fsharp: 'fsharp/fsharp-original.svg',
  visualbasic: 'visualbasic/visualbasic-original.svg', kotlin: 'kotlin/kotlin-original.svg',
  java: 'java/java-original.svg', scala: 'scala/scala-original.svg',
  go: 'go/go-original-wordmark.svg', c: 'c/c-original.svg', cpp: 'cplusplus/cplusplus-original.svg',
  objectivec: 'objectivec/objectivec-plain.svg', php: 'php/php-original.svg',
  ruby: 'ruby/ruby-original.svg', elixir: 'elixir/elixir-original.svg', lua: 'lua/lua-original.svg',
  node: 'nodejs/nodejs-original.svg', powershell: 'powershell/powershell-original.svg', r: 'r/r-original.svg',
  yaml: 'yaml/yaml-original.svg', json: 'json/json-original.svg', html: 'html5/html5-original.svg',
  css: 'css3/css3-original.svg', markdown: 'markdown/markdown-original.svg', docker: 'docker/docker-original.svg',
};
mkdirSync('public/assets/sdks', { recursive: true });
for (const [name, path] of Object.entries(names)) {
  if (selected && !selected.includes(name)) continue;
  const response = await fetch(`${base}/icons/${path}`);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  const svg = await response.text();
  if (!svg.includes('<svg') || /<script|<foreignObject|(?:href|src)=["'](?:https?:|\/\/|data:)/i.test(svg)) throw new Error(`Unsafe logo: ${path}`);
  writeFileSync(`public/assets/sdks/${name}.svg`, svg);
  // Rust's black gear and Lua's navy seal need a contrasting variant on black.
  if (['rust', 'lua', 'json', 'markdown'].includes(name)) {
    let dark = svg.replace(/(?:#[0-9a-f]{3,8}|\bblack\b|\bnavy\b)/gi, (color) => ['#fff', '#ffffff'].includes(color.toLowerCase()) ? '#0b0b10' : '#e8e8ed').replace('<svg ', '<svg fill="#e8e8ed" ');
    // JSON uses implicit black gradient stops, which do not inherit SVG fill.
    if (name === 'json') dark = dark.replace(/<stop offset="0"\/>/g, '<stop offset="0" stop-color="#e8e8ed"/>');
    writeFileSync(`public/assets/sdks/${name}-dark.svg`, dark);
  }
  console.log(`Vendored ${name}`);
}
const license = await fetch(`${base}/LICENSE`);
if (!license.ok) throw new Error('Missing Devicon license');
writeFileSync('public/assets/sdks/DEVICON-LICENSE.txt', await license.text());
writeFileSync('public/assets/sdks/NOTICE.md', `Language marks from [Devicon](https://github.com/devicons/devicon/tree/${revision}), revision ${revision}, under the accompanying MIT license. Rust, Lua, JSON, and Markdown have contrasting variants for dark backgrounds. All marks remain the property of their respective owners; inclusion does not imply endorsement. Assets are served locally.\n`);
