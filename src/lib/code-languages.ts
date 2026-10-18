import { bundledLanguages } from 'shiki';
import { assetPath, docsyConfig } from '../config';

type Language = { grammar: string; label: string; icon?: string; iconDark?: string };
const language = (grammar: string, label: string, icon = grammar, dark = false): Language => ({ grammar, label, icon: `assets/sdks/${icon}.svg`, ...(dark ? { iconDark: `assets/sdks/${icon}-dark.svg` } : {}) });
export const CODE_LANGUAGES: Record<string, Language> = {
  javascript: language('javascript', 'JavaScript'), typescript: language('typescript', 'TypeScript'),
  jsx: language('jsx', 'JSX', 'react'), tsx: language('tsx', 'TSX', 'react'),
  node: language('javascript', 'Node.js', 'node'), python: language('python', 'Python'),
  java: language('java', 'Java'), kotlin: language('kotlin', 'Kotlin'), scala: language('scala', 'Scala'),
  csharp: language('csharp', 'C#'), fsharp: language('fsharp', 'F#'), visualbasic: language('vb', 'Visual Basic', 'visualbasic'),
  c: language('c', 'C'), cpp: language('cpp', 'C++'), objectivec: language('objective-c', 'Objective-C', 'objectivec'),
  go: language('go', 'Go'), rust: language('rust', 'Rust', 'rust', true), swift: language('swift', 'Swift'),
  dart: language('dart', 'Dart'), php: language('php', 'PHP'), ruby: language('ruby', 'Ruby'),
  elixir: language('elixir', 'Elixir'), lua: language('lua', 'Lua', 'lua', true),
  powershell: language('powershell', 'PowerShell'), r: language('r', 'R'),
  yaml: language('yaml', 'YAML'), json: language('json', 'JSON', 'json', true),
  html: language('html', 'HTML', 'html'), css: language('css', 'CSS', 'css'),
  markdown: language('markdown', 'Markdown', 'markdown', true), dockerfile: language('dockerfile', 'Dockerfile', 'docker'),
  bash: { grammar: 'shellscript', label: 'Shell' }, curl: { grammar: 'shellscript', label: 'cURL' },
  xml: { grammar: 'xml', label: 'XML' }, sql: { grammar: 'sql', label: 'SQL' },
  http: { grammar: 'http', label: 'HTTP' }, toml: { grammar: 'toml', label: 'TOML' },
  text: { grammar: 'text', label: 'Plain text' },
};
const aliases: Record<string, string> = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', ts: 'typescript',
  'nodejs': 'node', 'node.js': 'node', py: 'python', rb: 'ruby', rs: 'rust', golang: 'go',
  cs: 'csharp', 'c#': 'csharp', fs: 'fsharp', 'f#': 'fsharp', vb: 'visualbasic', vbnet: 'visualbasic', 'vb.net': 'visualbasic',
  'c++': 'cpp', cxx: 'cpp', cc: 'cpp', objc: 'objectivec', 'objective-c': 'objectivec',
  kt: 'kotlin', kts: 'kotlin', ex: 'elixir', exs: 'elixir', ps: 'powershell', ps1: 'powershell',
  yml: 'yaml', jsonc: 'json', json5: 'json', md: 'markdown', sh: 'bash', shell: 'bash', shellscript: 'bash',
  console: 'bash', shellsession: 'bash', plaintext: 'text', plain: 'text', txt: 'text', '': 'text',
};

export function codeLanguage(value = 'text') {
  const requested = value.trim().toLowerCase().split(/\s+/)[0];
  const key = aliases[requested] || requested;
  const known = CODE_LANGUAGES[key];
  const grammar = requested === 'jsonc' || requested === 'json5' || requested === 'shellsession' ? requested : known?.grammar || key;
  const supported = grammar === 'text' || Object.hasOwn(bundledLanguages, grammar);
  // Respect the user's existing YAML SDK branding in code badges too.
  const sdk = docsyConfig.ingestion.sdks.find((source) => (aliases[source.language.toLowerCase()] || source.language.toLowerCase()) === key && source.icon);
  const icon = sdk?.icon || known?.icon;
  const iconDark = sdk?.icon ? sdk.iconDark : known?.iconDark;
  return { key, grammar: supported ? grammar : 'text', label: known?.label || value.trim().slice(0, 80) || 'Plain text', icon: icon ? assetPath(icon) : undefined, iconDark: iconDark ? assetPath(iconDark) : undefined };
}
