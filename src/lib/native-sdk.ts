// Native documentation artifacts are data. Never execute embedded JS, load Ruby
// Marshal/Python pickle, expand XML entities, or run generators during a docs build.
import { readFileSync, readdirSync, statSync, realpathSync, lstatSync } from 'node:fs';
import { resolve, relative, extname, basename, join, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { SyntaxValidator } from 'fast-xml-validator';
import { load as yaml } from 'js-yaml';
import { htmlTree, attribute, textContent, walkHtml } from './html-content';
import type { SDKDoc, NormalizedItem, NormalizedMethod, NormalizedParameter } from './sdk-loaders';
import type { SdkSourceConfig } from '../config';

type Meta = Omit<SDKDoc, 'itemCount' | 'categories'>;
type Html = ReturnType<typeof htmlTree>;
const many = <T>(value: T | T[] | undefined | null): T[] => value == null ? [] : Array.isArray(value) ? value : [value];
const clean = (value: string) => value.replace(/[¶#]$/g, '').replace(/\s+/g, ' ').trim();
const txt = (value: any): string => typeof value === 'string' || typeof value === 'number' ? String(value) : value == null ? '' : Array.isArray(value) ? value.map(txt).join(' ') : typeof value === 'object' ? Object.entries(value).filter(([key]) => !key.startsWith('@_')).map(([, val]) => txt(val)).join(' ') : '';
const plain = (value: any): string => clean(textContent(htmlTree(txt(value))));
const id = (value: string) => `${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${createHash('sha256').update(value).digest('hex').slice(0, 8)}`;
const cls = (node: Html, name: string) => (attribute(node, 'class') || '').split(/\s+/).includes(name);
const nodes = (root: Html, predicate: (node: Html) => boolean): Html[] => { const found: Html[] = []; walkHtml(root, (node) => { if (predicate(node)) found.push(node); }); return found; };
const first = (root: Html, predicate: (node: Html) => boolean) => nodes(root, predicate)[0];
const content = (root?: Html) => root ? clean(textContent(root)) : '';
// Code is not prose: inserting spaces between syntax-highlighter spans can
// change programs, while collapsing whitespace loses indentation and line breaks.
const codeText = (node: Html): string => ['script', 'style'].includes(node.tagName || '') ? '' : node.nodeName === '#text' ? node.value || '' : node.tagName === 'br' ? '\n' : (node.childNodes || []).map(codeText).join('');
const child = (root: Html, tag: string) => root.childNodes?.find((node) => node.tagName === tag);
const nextElement = (node: Html): Html | undefined => { const siblings = (node as Html & { parentNode?: Html }).parentNode?.childNodes || []; return siblings.slice(siblings.indexOf(node) + 1).find((entry) => Boolean(entry.tagName)); };
const definitionTerms = (root: Html) => nodes(root, (node) => node.tagName === 'dt').map((dt) => ({ term: content(dt).toLowerCase().replace(/:$/, '').trim(), body: nextElement(dt) })).filter((pair): pair is { term: string; body: Html } => pair.body?.tagName === 'dd');
const paragraph = (root: Html) => content(first(root, (node) => node.tagName === 'p' && !cls(node, 'source')));
const htmlCode = (value: string) => { const root = htmlTree(value); const blocks = nodes(root, (node) => node.tagName === 'pre'); return blocks.length ? blocks.map((node) => codeText(node).trim()).join('\n\n') : codeText(root).trim(); };
const descendants = (value: any, key: string): any[] => !value || typeof value !== 'object' ? [] : Object.entries(value).flatMap(([name, val]) => name === key ? many(val) : descendants(val, key));
const prose = (value: any): string => typeof value !== 'object' || value === null ? txt(value) : Array.isArray(value) ? value.map(prose).join(' ') : Object.entries(value).filter(([key]) => !key.startsWith('@_') && !['programlisting', 'parameterlist', 'simplesect'].includes(key)).map(([, val]) => prose(val)).join(' ');
const jsonNodes = (value: any, predicate: (node: any) => boolean): any[] => !value || typeof value !== 'object' ? [] : [...(predicate(value) ? [value] : []), ...Object.values(value).flatMap((child) => jsonNodes(child, predicate))];
const parentOf = (node: Html) => (node as Html & { parentNode?: Html }).parentNode;
const ownedBy = (node: Html, root: Html, boundary: (node: Html) => boolean) => { for (let parent = parentOf(node); parent && parent !== root; parent = parentOf(parent)) if (boundary(parent)) return false; return true; };
const xml = (path: string) => {
  const source = readFileSync(path, 'utf8');
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error(`XML declarations/entities are not allowed: ${path}`);
  try { SyntaxValidator.validate(source); } catch (error) { throw new Error(`Invalid native XML ${path}: ${error instanceof Error ? error.message : String(error)}`); }
  return new XMLParser({ ignoreAttributes: false, processEntities: false, trimValues: false }).parse(source);
};

// Bound file walks, reject symlinks and links escaping the selected artifact.
function artifactFiles(source: string, extensions: string[], config: SdkSourceConfig): string[] {
  if (lstatSync(resolve(source)).isSymbolicLink()) throw new Error(`Native SDK source cannot be a symlink: ${source}`);
  const root = realpathSync(resolve(source)); const out: string[] = []; let bytes = 0, visited = 0;
  const maxFiles = config.maxFiles ?? 10000, maxFileBytes = config.maxFileBytes ?? 10 * 1024 * 1024, maxTotalBytes = config.maxTotalBytes ?? 100 * 1024 * 1024;
  const walk = (path: string) => {
    if (++visited > maxFiles * 10) throw new Error(`Native SDK directory walk exceeds its entry limit: ${source}`);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`Native SDK artifacts cannot contain symlinks: ${path}`);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(path).sort()) {
        if (/^(?:node_modules|\.git|\.build|target|bin|obj|_build|deps|__pycache__)$/.test(entry)) continue;
        walk(join(path, entry));
      }
    } else if (extensions.includes(extname(path).toLowerCase())) {
      if (stat.size > maxFileBytes) throw new Error(`Native artifact exceeds maxFileBytes: ${path}`);
      bytes += stat.size; if (bytes > maxTotalBytes) throw new Error(`Native SDK source exceeds maxTotalBytes: ${source}`);
      out.push(path); if (out.length > maxFiles) throw new Error(`Native SDK source exceeds maxFiles: ${source}`);
    }
  };
  walk(root); if (!out.length) throw new Error(`No ${extensions.join('/')} artifacts found at ${source}`);
  return out;
}

function finalize(items: NormalizedItem[], meta: Meta): SDKDoc {
  const unique = new Map<string, NormalizedItem>();
  for (const item of items) {
    if (!item.name || !item.id) continue;
    const previous = unique.get(item.id);
    if (previous) {
      // Keep overloads rather than silently losing signatures.
      if (item.declaration && !previous.declaration?.includes(item.declaration)) previous.declaration = [previous.declaration, item.declaration].filter(Boolean).join('\n');
    } else unique.set(item.id, item);
  }
  if (!unique.size) throw new Error(`No supported API symbols were found in the native ${meta.name} artifact. Check its format and generator version.`);
  const byName = new Map([...unique.values()].flatMap((item) => [[item.name, item], [item.name.split('.').at(-1)!, item]] as [string, NormalizedItem][]));
  for (const item of unique.values()) for (const relation of item.relationships || []) {
    const target = byName.get(relation.name); if (target) relation.target = `#${target.id}`;
  }
  const buckets = new Map<string, NormalizedItem[]>();
  for (const item of unique.values()) {
    const category = item.category || ({ class: 'Classes', struct: 'Structs', interface: 'Interfaces', protocol: 'Protocols', enum: 'Enums', method: 'Methods', constructor: 'Constructors', function: 'Functions', module: 'Modules', namespace: 'Namespaces', property: 'Properties', type: 'Types' } as Record<string, string>)[item.kind] || 'Symbols';
    if (!buckets.has(category)) buckets.set(category, []); buckets.get(category)!.push(item);
  }
  return { ...meta, itemCount: unique.size, categories: [...buckets].map(([title, symbols]) => ({ title, items: symbols.sort((a, b) => a.name.localeCompare(b.name)) })) };
}

// Signatures come from the native generator, not source-code regex extraction.
// This fallback supplements formats which expose signatures but no parameter AST.
function signatureParameters(signature: string, language: string): NormalizedParameter[] {
  const start = signature.indexOf('('); if (start < 0) return [];
  let depth = 0, end = start + 1;
  for (; end < signature.length; end++) { const char = signature[end]; if (char === '(') depth++; else if (char === ')' && depth-- === 0) break; }
  const list = signature.slice(start + 1, end); if (!list.trim()) return [];
  let dartNamed = false;
  return list.split(/,(?![^<\[]*[>\]])/).map((part) => {
    if (language === 'dart' && /^\s*\{/.test(part)) dartNamed = true;
    const optional = /=/.test(part) || (language === 'dart' && dartNamed);
    const value = part.split('=')[0].trim().replace(language === 'dart' ? /^[{}]+|[{}]+$/g : /^$/, '').trim();
    if (!value || value === 'self' || value === 'void') return null;
    const colon = value.match(/^(?:(\w+)\s+)?([\w$?]+)\s*:\s*(.+)$/);
    if (colon) return { name: colon[2].replace(/\?$/, ''), type: colon[3], optional };
    const words = value.split(/\s+/);
    if (language === 'go') return { name: words[0], type: words.slice(1).join(' ') || 'unknown', optional };
    return { name: words.at(-1)!.replace(/^[*&$]+/, ''), type: words.slice(0, -1).join(' ') || 'unknown', optional };
  }).filter((value): value is NonNullable<typeof value> => Boolean(value));
}
const methodOf = (item: NormalizedItem): NormalizedMethod => ({ name: item.name, description: item.summary, parameters: item.parameters || [], returnType: item.returnType, isAsync: /\basync\b|\bsuspend\b/.test(item.declaration || '') });

function typedoc(paths: string[], meta: Meta): NormalizedItem[] {
  const output: NormalizedItem[] = [];
  const typeText = (type: any): string => !type ? 'unknown' : type.type === 'array' ? `${typeText(type.elementType)}[]` : type.type === 'union' || type.type === 'intersection' ? many(type.types).map(typeText).join(type.type === 'union' ? ' | ' : ' & ') : type.type === 'literal' ? JSON.stringify(type.value) : type.name ? `${type.name}${type.typeArguments?.length ? `<${type.typeArguments.map(typeText).join(', ')}>` : ''}` : type.type === 'tuple' ? `[${many(type.elements).map(typeText).join(', ')}]` : type.type === 'reflection' ? 'object' : type.type || 'unknown';
  const summary = (comment: any) => many(comment?.summary).map((part: any) => part.text || '').join('').trim();
  const tag = (comment: any, name: string) => many(comment?.blockTags).filter((part: any) => part.tag === name).map((part: any) => many(part.content).map((token: any) => token.text || '').join('')).join('\n');
  const kinds: Record<number, string> = { 2: 'module', 4: 'namespace', 8: 'enum', 16: 'enum-member', 32: 'variable', 64: 'function', 128: 'class', 256: 'interface', 512: 'constructor', 1024: 'property', 2048: 'method', 2097152: 'type', 4194304: 'type', 262144: 'property' };
  const walk = (node: any, ancestors: string[] = []) => {
    const qualified = [...ancestors, node.name].join('.'); const kind = kinds[node.kind];
    const signatures = many(node.signatures || node.type?.declaration?.signatures);
    const signature: any = signatures[0] || node.getSignature || node.setSignature;
    const comment = node.comment || signature?.comment;
    const item: NormalizedItem = { id: id(qualified), name: ancestors.length && !['module', 'namespace'].includes(kind) ? qualified : node.name, kind: kind || 'symbol', language: meta.language, summary: summary(comment) || undefined, category: ancestors.filter((name) => name !== '<global>').join(' · ') || undefined };
    if (signature) {
      item.parameters = many(signature.parameters).map((param: any) => ({ name: param.name, type: typeText(param.type), optional: param.flags?.isOptional || param.defaultValue !== undefined, description: summary(param.comment) || undefined }));
      item.returnType = typeText(signature.type); item.returnsDoc = tag(comment, '@returns') || undefined;
      item.declaration = signatures.map((sig: any) => `${node.name}(${many(sig.parameters).map((p: any) => `${p.name}${p.flags?.isOptional ? '?' : ''}: ${typeText(p.type)}`).join(', ')}): ${typeText(sig.type)}`).join('\n');
    } else if (['class', 'interface', 'enum', 'namespace', 'module', 'type'].includes(kind)) item.declaration = `${kind} ${node.name}${node.extendedTypes?.length ? ` extends ${node.extendedTypes.map(typeText).join(', ')}` : ''}`;
    else if (node.type) item.declaration = `${node.name}: ${typeText(node.type)}`;
    item.example = tag(comment, '@example').replace(/^```[^\n]*\n|\n```$/g, '') || undefined;
    item.remarks = tag(comment, '@remarks') || undefined;
    item.throws = many(node.comment?.blockTags || signature?.comment?.blockTags).filter((entry: any) => entry.tag === '@throws').map((entry: any) => { const value = many(entry.content).map((part: any) => part.text || '').join(''); const [type, ...description] = value.split(/\s+/); return { type, description: description.join(' ') }; });
    item.relationships = [...many(node.extendedTypes), ...many(node.implementedTypes)].map((type: any) => ({ name: typeText(type) }));
    item.deprecated = tag(comment, '@deprecated') || (many(comment?.modifierTags).includes('@deprecated') ? true : undefined);
    item.properties = many(node.children).filter((entry: any) => entry.kind === 1024).map((entry: any) => ({ name: entry.name, type: typeText(entry.type), optional: entry.flags?.isOptional, description: summary(entry.comment), defaultValue: entry.defaultValue }));
    item.methods = many(node.children).filter((entry: any) => [2048, 512].includes(entry.kind)).flatMap((entry: any) => many(entry.signatures).map((sig: any) => ({ name: entry.name, returnType: typeText(sig.type), description: summary(entry.comment || sig.comment), parameters: many(sig.parameters).map((p: any) => ({ name: p.name, type: typeText(p.type), optional: p.flags?.isOptional || p.defaultValue !== undefined, description: summary(p.comment) })) })));
    if (kind === 'enum') item.values = many(node.children).map((entry: any) => entry.name);
    if (kind && !node.flags?.isPrivate && !node.flags?.isProtected) output.push(item);
    for (const child of node.children || []) walk(child, node.kind === 1 ? [] : [...ancestors, node.name]);
  };
  for (const path of paths) { const data = JSON.parse(readFileSync(path, 'utf8')); if (!Array.isArray(data.children)) throw new Error(`Not TypeDoc project JSON: ${path}`); walk(data); }
  return output;
}

function jsdoc(paths: string[], meta: Meta): NormalizedItem[] {
  const output: NormalizedItem[] = [];
  for (const path of paths) {
    const docs = JSON.parse(readFileSync(path, 'utf8')); if (!Array.isArray(docs)) throw new Error(`Not JSDoc -X output: ${path}`);
    for (const doc of docs) {
      if (!['class', 'function', 'member', 'module', 'namespace', 'typedef', 'constant'].includes(doc.kind) || doc.undocumented || ['private', 'protected'].includes(doc.access)) continue;
      const parameters = many(doc.params).map((p: any) => ({ name: p.name, type: many(p.type?.names).join(' | ') || 'unknown', optional: p.optional, description: plain(p.description) }));
      const kind = doc.kind === 'function' && doc.memberof ? 'method' : doc.kind === 'member' ? 'property' : doc.kind;
      output.push({ id: id(doc.longname || doc.name), name: doc.longname || doc.name, kind, category: doc.memberof, language: meta.language, summary: plain(doc.classdesc || doc.description), parameters, returnType: many(doc.returns?.[0]?.type?.names).join(' | ') || (kind === 'property' ? many(doc.type?.names).join(' | ') : undefined), returnsDoc: plain(doc.returns?.[0]?.description), example: many(doc.examples).join('\n') || undefined, throws: many(doc.exceptions).map((error: any) => ({ type: many(error.type?.names).join(' | ') || 'Error', description: plain(error.description) })), relationships: many(doc.augments).map((name: any) => ({ name: String(name) })), deprecated: doc.deprecated, declaration: `${kind} ${doc.name}${doc.kind === 'function' ? `(${parameters.map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ')})` : ''}` });
    }
  }
  return output;
}

function docfx(paths: string[], meta: Meta): NormalizedItem[] {
  const output: NormalizedItem[] = [];
  for (const path of paths) {
    const data: any = yaml(readFileSync(path, 'utf8')); if (!data?.items) continue;
    for (const item of data.items) {
      const vb = meta.language === 'visualbasic';
      const declaration = (vb ? item.syntax?.['content.vb'] : item.syntax?.[`content.${meta.language}`]) || item.syntax?.content;
      const parameters = many(item.syntax?.parameters).map((p: any) => ({ name: p.id, type: p.type || 'unknown', description: plain(p.description), optional: p.optional }));
      output.push({ id: id(item.uid), name: (vb ? item['fullName.vb'] : item.fullName) || item.name, kind: (item.type || 'symbol').toLowerCase(), category: item.namespace || item.parent, language: vb ? 'vbnet' : meta.language === 'fsharp' && !item.syntax?.['content.fsharp'] ? 'csharp' : meta.language, summary: plain(item.summary), remarks: plain(item.remarks) || undefined, declaration, parameters, returnType: item.syntax?.return?.type, returnsDoc: plain(item.syntax?.return?.description), values: item.type === 'Enum' ? data.items.filter((entry: any) => entry.parent === item.uid && entry.type === 'Field').map((entry: any) => entry.name) : undefined, example: many(item.example).map((value: any) => htmlCode(String(value))).join('\n\n') || undefined, exampleLanguage: vb ? 'vbnet' : meta.language, throws: many(item.exceptions).map((error: any) => ({ type: error.type, description: plain(error.description) })), relationships: [...many(item.inheritance), ...many(item.implements)].map((name: any) => ({ name: String(name) })) });
    }
  }
  if (!output.length) throw new Error('Expected DocFX ManagedReference YAML items, not a table of contents or rendered HTML.');
  return output;
}

function doxygen(paths: string[], meta: Meta): NormalizedItem[] {
  const output: NormalizedItem[] = [];
  for (const path of paths) {
    const doc = xml(path);
    // Parse code listings in document order. The object-shaped XML AST groups
    // repeated highlights and cannot faithfully reconstruct source code.
    const markup = htmlTree(readFileSync(path, 'utf8').replace(/<sp\s*\/>/g, ' '));
    const example = (key: string) => { const body = first(markup, (node) => attribute(node, 'id') === key); return body ? nodes(body, (node) => node.tagName === 'programlisting').map((listing) => nodes(listing, (node) => node.tagName === 'codeline').map(codeText).join('\n')).join('\n\n') || undefined : undefined; };
    for (const compound of many(doc.doxygen?.compounddef)) {
      const kind = compound['@_kind']; const name = txt(compound.compoundname).trim();
      const members = many(compound.sectiondef).flatMap((section: any) => many(section.memberdef));
      const convert = (member: any): NormalizedItem => {
        const params = many(member.param).map((p: any) => ({ name: txt(p.declname || p.defname), type: clean(txt(p.type)), optional: Boolean(p.defval), description: '' }));
        const lists = descendants(member.detaileddescription, 'parameterlist');
        const descriptions = lists.filter((list: any) => list['@_kind'] === 'param').flatMap((list: any) => many(list.parameteritem));
        for (const param of params) param.description = plain(descriptions.find((description: any) => txt(description.parameternamelist?.parametername).trim() === param.name)?.parameterdescription);
        const memberName = txt(member.name).trim();
        return { id: id(member['@_id']), name: `${['class', 'struct', 'interface', 'namespace'].includes(kind) ? `${name}.` : ''}${memberName}`, kind: member['@_kind'] === 'function' ? ['class', 'struct', 'interface'].includes(kind) ? 'method' : 'function' : member['@_kind'] === 'variable' ? 'property' : member['@_kind'], category: ['file', 'dir'].includes(kind) ? undefined : name, language: meta.language, summary: plain(member.briefdescription) || plain(prose(member.detaileddescription)), declaration: `${clean(txt(member.definition))}${clean(txt(member.argsstring))}`, parameters: params, returnType: clean(txt(member.type)) || undefined, returnsDoc: descendants(member.detaileddescription, 'simplesect').filter((section: any) => section['@_kind'] === 'return').map((section: any) => plain(prose(section))).join(' ') || undefined, throws: lists.filter((list: any) => list['@_kind'] === 'exception').flatMap((list: any) => many(list.parameteritem)).map((error: any) => ({ type: txt(error.parameternamelist?.parametername).trim(), description: plain(error.parameterdescription) })), values: many(member.enumvalue).map((entry: any) => txt(entry.name).trim()), example: example(member['@_id']) };
      };
      const converted = members.map(convert);
      if (['class', 'struct', 'interface', 'namespace', 'union'].includes(kind)) { const compoundBody = first(markup, (node) => attribute(node, 'id') === compound['@_id']); const detail = compoundBody && child(compoundBody, 'detaileddescription'); output.push({ id: id(compound['@_id']), name, kind, language: meta.language, summary: plain(compound.briefdescription) || plain(prose(compound.detaileddescription)), declaration: `${kind} ${name}`, example: detail ? nodes(detail, (node) => node.tagName === 'programlisting').map((listing) => nodes(listing, (node) => node.tagName === 'codeline').map(codeText).join('\n')).join('\n\n') || undefined : undefined, methods: converted.filter((item) => item.kind === 'method').map(methodOf), properties: converted.filter((item) => item.kind === 'property').map((item) => ({ name: item.name, type: item.returnType || 'unknown', description: item.summary })), relationships: many(compound.basecompoundref).map((ref: any) => ({ name: txt(ref).trim() })) }); }
      output.push(...converted);
    }
  }
  return output;
}

function phpdoc(paths: string[], meta: Meta): NormalizedItem[] {
  const output: NormalizedItem[] = [];
  const convert = (item: any, kind: string): NormalizedItem => {
    const tags = many(item.docblock?.tag);
    const tag = (name: string) => tags.filter((entry: any) => entry['@_name'] === name);
    return { id: id(txt(item.full_name || item.name)), name: txt(item.full_name || item.name).trim(), kind, language: meta.language, summary: plain(item.docblock?.description), remarks: plain(item.docblock?.['long-description']) || undefined, parameters: many(item.argument).map((arg: any) => ({ name: txt(arg.name).trim(), type: txt(arg.type).trim() || 'mixed', optional: Boolean(txt(arg.default).trim()), description: plain(tags.find((tag: any) => tag['@_name'] === 'param' && tag['@_variable'] === txt(arg.name).trim())?.['@_description']) })), returnType: tag('return')[0]?.['@_type'] || (kind === 'property' ? txt(item.type).trim() : undefined), returnsDoc: plain(tag('return')[0]?.['@_description']), example: tag('example').map((entry: any) => htmlCode(entry['@_description'] || '')).join('\n') || undefined, throws: tag('throws').map((entry: any) => ({ type: entry['@_type'], description: plain(entry['@_description']) })), deprecated: tag('deprecated').map((entry: any) => plain(entry['@_description'])).join(' ') || undefined, declaration: `${['class', 'interface', 'trait', 'property'].includes(kind) ? kind : 'function'} ${txt(item.name).trim()}${['class', 'interface', 'trait', 'property'].includes(kind) ? '' : `(${many(item.argument).map((arg: any) => `${txt(arg.type).trim()} $${txt(arg.name).trim().replace(/^\$/, '')}`).join(', ')})`}` };
  };
  for (const path of paths) {
    const doc = xml(path); for (const file of many(doc.project?.file)) {
      for (const key of ['class', 'interface', 'trait']) for (const item of many(file[key])) { const parent = convert(item, key); parent.methods = many(item.method).map((method: any) => methodOf(convert(method, 'method'))); parent.properties = many(item.property).map((property: any) => ({ name: txt(property.name).trim(), type: txt(property.type).trim() || 'mixed', description: plain(property.docblock?.description), defaultValue: txt(property.default).trim() || undefined })); output.push(parent, ...many(item.method).map((method: any) => convert(method, 'method')), ...many(item.property).map((property: any) => convert(property, 'property'))); }
      output.push(...many(file.function).map((item: any) => convert(item, 'function')));
    }
  }
  return output;
}

function docc(paths: string[], meta: Meta): NormalizedItem[] {
  const output: NormalizedItem[] = [];
  const render = (value: any): string => typeof value === 'string' ? value : Array.isArray(value) ? value.map(render).join('') : value?.text || (typeof value?.code === 'string' ? value.code : '') || render(value?.inlineContent || value?.content || []);
  for (const path of paths) {
    const doc = JSON.parse(readFileSync(path, 'utf8')); if (doc.kind !== 'symbol' || !doc.identifier?.url || !doc.metadata?.title) continue;
    const sections = doc.primaryContentSections || [];
    const declaration = sections.flatMap((section: any) => section.declarations || []).map((entry: any) => (entry.tokens || []).map((token: any) => token.text).join('')).join('\n');
    const params = signatureParameters(declaration, meta.language);
    for (const param of sections.flatMap((section: any) => section.parameters || [])) { const existing = params.find((p) => p.name === param.name); if (existing) existing.description = clean(render(param.content)); else params.push({ name: param.name, type: 'unknown', description: clean(render(param.content)) }); }
    const kind = ({ func: 'function', init: 'constructor' } as any)[doc.metadata.symbolKind] || doc.metadata.symbolKind || 'symbol';
    const examples = jsonNodes(sections, (entry) => entry.type === 'codeListing');
    const errors = jsonNodes(sections, (entry) => entry.type === 'aside' && entry.name === 'Throws');
    output.push({ id: id(doc.identifier.url), name: doc.metadata.title, kind, category: doc.metadata.modules?.[0]?.name, language: meta.language, summary: clean(render(doc.abstract)), declaration, parameters: params, returnType: declaration.match(/->\s*(.+)$/)?.[1], example: examples.map((entry) => many(entry.code).join('\n')).join('\n\n') || undefined, throws: errors.map((entry) => ({ type: 'Throws', description: clean(render(entry.content)) })), values: kind === 'enum' ? many(doc.topicSections).flatMap((section: any) => section.title === 'Enumeration Cases' || section.title === 'Cases' ? section.identifiers || [] : []).map((ref: any) => doc.references?.[ref]?.title || String(ref)) : undefined, returnsDoc: clean(render(sections.filter((section: any) => section.kind === 'content').flatMap((section: any) => section.content?.some((entry: any) => entry.anchor === 'return-value') ? section.content.filter((entry: any) => entry.type !== 'heading') : []))), relationships: (doc.relationshipsSections || []).flatMap((section: any) => section.identifiers || []).map((ref: string) => ({ name: doc.references?.[ref]?.title || ref })) });
  }
  return output;
}

function godoc(paths: string[], _meta: Meta): NormalizedItem[] {
  const output: NormalizedItem[] = [];
  for (const path of paths) {
    const source = readFileSync(path, 'utf8'); if (!/^package \w+/m.test(source)) throw new Error(`Expected go doc -all output: ${path}`);
    const parts = source.split(/\n(?=(?:type|func|const|var) )/);
    for (const part of parts) {
      const lines = part.split('\n'); const declaration = lines[0];
      const match = declaration.match(/^(type|func|const|var) (?:\(([^)]+)\) )?([\w]+)/); if (!match) continue;
      const parent = match[2]?.split(/\s+/).at(-1)?.replace('*', '');
      const summary = lines.slice(1).filter((line) => /^ {4}\S/.test(line) && line.trim() !== 'Usage:').map((line) => line.trim()).join(' ');
      const example = lines.filter((line) => /^ {8}/.test(line)).map((line) => line.slice(8)).join('\n') || undefined;
      const fullDeclaration = declaration.startsWith('type ') ? lines.slice(0, lines.findIndex((line, index) => index > 0 && line === '}') + 1).join('\n') || declaration : declaration;
      const paramsSignature = parent ? declaration.replace(/^func \([^)]+\) /, 'func ') : declaration;
      output.push({ id: id(`${parent || ''}.${match[3]}`), name: `${parent ? `${parent}.` : ''}${match[3]}`, kind: match[1] === 'type' ? /\bstruct\b/.test(declaration) ? 'struct' : /\binterface\b/.test(declaration) ? 'interface' : 'type' : match[1] === 'func' ? parent ? 'method' : 'function' : 'variable', category: parent, language: 'go', summary, declaration: fullDeclaration, example, parameters: match[1] === 'func' ? signatureParameters(paramsSignature, 'go') : [], returnType: match[1] === 'func' ? paramsSignature.match(/\)\s+(.+)$/)?.[1] : undefined, properties: /\bstruct\b/.test(declaration) ? lines.filter((line) => /^\t\w+\s+/.test(line)).map((line) => { const [name, ...type] = line.trim().split(/\s+/); return { name, type: type.join(' ') }; }) : undefined });
    }
  }
  return output;
}

function htmlSymbols(paths: string[], format: string, meta: Meta, sourceRoot: string): NormalizedItem[] {
  const output: NormalizedItem[] = [];
  for (const path of paths) {
    const keyPath = relative(statSync(sourceRoot).isDirectory() ? sourceRoot : dirnamePath(sourceRoot), path).replaceAll('\\', '/');
    const source = readFileSync(path, 'utf8');
    const root = htmlTree(format === 'sphinx' ? JSON.parse(source).body || '' : source);
    const make = (key: string, name: string, kind: string, signature: string, body: Html, extra: Partial<NormalizedItem> = {}) => {
      const params = ['class', 'struct', 'interface', 'enum', 'module', 'property'].includes(kind) ? [] : signatureParameters(signature, meta.language);
      // Native parameter descriptions are retained even when their type is only
      // present in the signature. Full prose also remains in summary/search.
      const bodyText = content(body);
      const pairs = definitionTerms(body).filter((pair) => ownedBy(pair.body, body, (node) => node.tagName === 'dl' && /\b(?:method|class|attribute)\b/.test(attribute(node, 'class') || '')));
      const returns = pairs.find((pair) => /^(?:returns?|return value)$/.test(pair.term));
      const errors = pairs.filter((pair) => /^(?:raises?|throws?|exceptions?(?: thrown)?)$/.test(pair.term)).flatMap((pair) => { const entries = nodes(pair.body, (node) => node.tagName === 'li'); return (entries.length ? entries : [pair.body]).map((entry) => ({ type: content(first(entry, (node) => node.tagName === 'code' || node.tagName === 'strong')) || 'Error', description: content(entry) })); });
      for (const parameter of params) { const pair = pairs.find((pair) => pair.term === parameter.name.toLowerCase()); if (pair) parameter.description = content(pair.body); }
      for (const pair of pairs.filter((pair) => pair.term === 'parameters')) {
        const descriptions = nodes(pair.body, (node) => node.tagName === 'li' || node.tagName === 'p');
        for (const parameter of params) { const description = descriptions.find((node) => content(first(node, (entry) => entry.tagName === 'code' || entry.tagName === 'strong')) === parameter.name); if (description) parameter.description = content(description).replace(/^\S+\s*(?:\([^)]*\))?\s*[–—-]\s*/, ''); }
      }
      const blocks = nodes(body, (node) => node.tagName === 'pre').filter((node) => ownedBy(node, body, (parent) => cls(parent, 'source_code') || cls(parent, 'specs') || (format === 'sphinx' && parent.tagName === 'dl' && /\b(?:method|class|attribute)\b/.test(attribute(parent, 'class') || ''))));
      output.push({ id: id(key), name: clean(name), kind, language: meta.language, summary: paragraph(body) || content(first(body, (node) => cls(node, 'block'))) || (kind === 'constructor' ? undefined : bodyText.slice(0, 1000)), declaration: clean(signature), parameters: params, returnType: signature.match(/(?:->|→|⇒|::|\)\s*:)\s*(.+)$/)?.[1], returnsDoc: returns ? content(returns.body) : undefined, throws: errors, example: blocks.map((node) => codeText(node).trim()).join('\n\n') || undefined, ...extra });
    };
    if (format === 'sphinx') {
      for (const dl of nodes(root, (node) => node.tagName === 'dl' && (attribute(node, 'class') || '').split(/\s+/).some((name) => ['class', 'method', 'function', 'attribute', 'exception', 'data'].includes(name)))) {
        const dt = child(dl, 'dt'), dd = child(dl, 'dd'); if (!dt || !dd || !attribute(dt, 'id')) continue;
        const kind = cls(dl, 'class') || cls(dl, 'exception') ? 'class' : cls(dl, 'method') ? 'method' : cls(dl, 'function') ? 'function' : 'property';
        const key = attribute(dt, 'id')!; make(key, key, kind, clean(codeText(dt)), dd);
      }
    } else if (format === 'javadoc') {
      const declaration = first(root, (node) => cls(node, 'type-signature'));
      const heading = first(root, (node) => cls(node, 'title') && /^h[12]$/.test(node.tagName || ''));
      if (declaration && heading) make(`${keyPath}:type`, content(heading).replace(/^(?:Enum Class|Class|Interface|Enum|Record) /, ''), /\benum\b/.test(content(declaration)) ? 'enum' : /\binterface\b/.test(content(declaration)) ? 'interface' : 'class', clean(codeText(declaration)), first(root, (node) => cls(node, 'class-description')) || root, { values: /\benum\b/.test(content(declaration)) ? nodes(first(root, (node) => attribute(node, 'id') === 'enum-constant-detail') || htmlTree(''), (node) => cls(node, 'detail')).map((node) => attribute(node, 'id')!) : undefined });
      for (const section of nodes(root, (node) => cls(node, 'detail'))) {
        const signature = first(section, (node) => cls(node, 'member-signature')); if (!signature) continue;
        const name = content(first(section, (node) => node.tagName === 'h3'));
        const returnType = content(signature).split(name)[0].trim().split(/\s+/).filter((word) => !['public', 'private', 'protected', 'static', 'final', 'abstract', 'synchronized'].includes(word)).at(-1);
        const isCallable = codeText(signature).includes('(');
        make(`${keyPath}:${attribute(section, 'id')}`, name, isCallable ? returnType ? 'method' : 'constructor' : 'property', clean(codeText(signature)), section, { returnType, deprecated: content(first(section, (node) => cls(node, 'deprecation-comment'))) || undefined });
      }
    } else if (format === 'rustdoc') {
      const main = first(root, (node) => node.tagName === 'main') || root;
      const declaration = first(main, (node) => cls(node, 'item-decl'));
      const title = first(main, (node) => cls(node, 'fqn') || cls(node, 'main-heading'));
      if (declaration && title) make(`${keyPath}:type`, content(title).replace(/Copy item path.*$/, '').replace(/^.*\b(?:Struct|Enum|Trait|Function|Module|Type Alias)\s+/, ''), basename(path).split('.')[0], clean(codeText(declaration)), first(main, (node) => cls(node, 'docblock')) || main, { values: basename(path).startsWith('enum.') ? nodes(main, (node) => node.tagName === 'section' && (attribute(node, 'id') || '').startsWith('variant.')).map((node) => attribute(node, 'id')!.slice(8)) : undefined, properties: nodes(main, (node) => node.tagName === 'span' && (attribute(node, 'id') || '').startsWith('structfield.')).map((node) => { const value = content(node).split(':'); return { name: value[0].replace(/^§\s*/, ''), type: value.slice(1).join(':').trim() || 'unknown' }; }) });
      for (const section of nodes(main, (node) => node.tagName === 'section' && cls(node, 'method'))) {
        const signature = first(section, (node) => cls(node, 'code-header'));
        const sectionId = attribute(section, 'id'); if (!signature || !sectionId) continue;
        const parent = nodes(main, (node) => node.tagName === 'details').filter((node) => nodes(node, (candidate) => candidate === section).length).at(-1);
        const body = parent || section;
        const errorHeading = first(body, (node) => /^h[2-6]$/.test(node.tagName || '') && /^errors\b/i.test(content(node).replace(/^§\s*/, '')));
        make(`${keyPath}:${sectionId}`, sectionId.replace(/^method\./, ''), 'method', clean(codeText(signature)), body, { throws: errorHeading ? [{ type: 'Result::Err', description: content(nextElement(errorHeading)) }] : [] });
      }
    } else if (format === 'dokka') {
      const main = first(root, (node) => attribute(node, 'id') === 'content') || root;
      const cover = first(main, (node) => node.tagName === 'div' && cls(node, 'cover'));
      const symbols = nodes(main, (node) => cls(node, 'symbol') && cls(node, 'monospace'));
      const owned = basename(path) === 'index.html' ? (cover ? nodes(cover, (node) => cls(node, 'symbol') && cls(node, 'monospace')) : []) : symbols;
      for (const symbol of owned) {
        const signature = clean(codeText(symbol)); if (!/\b(class|interface|fun|val|var|object|typealias|enum)\b/.test(signature)) continue;
        const name = signature.match(/\b(?:enum(?:\s+class)?|class|interface|fun|val|var|object|typealias)\s+([\w.]+)/)?.[1] || basename(dirnamePath(path));
        const throwsHeading = first(main, (node) => /^h[2-6]$/.test(node.tagName || '') && content(node) === 'Throws');
        const errorTable = throwsHeading && nextElement(throwsHeading);
        const errors = errorTable ? nodes(errorTable, (node) => cls(node, 'main-subrow') && cls(node, 'keyValue')).map((row) => { const columns = (row.childNodes || []).filter((node) => node.tagName === 'div'); return { type: columns[0] ? clean(codeText(columns[0])) : 'Error', description: content(columns[1]) }; }) : [];
        const parameters = /\bfun\b/.test(signature) ? signatureParameters(signature, meta.language) : [];
        const paramsHeading = first(main, (node) => /^h[2-6]$/.test(node.tagName || '') && content(node) === 'Parameters');
        const paramsTable = paramsHeading && nextElement(paramsHeading);
        if (paramsTable) for (const row of nodes(paramsTable, (node) => cls(node, 'main-subrow') && cls(node, 'keyValue'))) { const columns = (row.childNodes || []).filter((node) => node.tagName === 'div'); const parameter = parameters.find((p) => p.name === clean(codeText(columns[0]))); if (parameter) parameter.description = content(columns[1]); }
        const entriesHeading = first(main, (node) => /^h[2-6]$/.test(node.tagName || '') && content(node) === 'Entries');
        const entriesTable = entriesHeading && nextElement(entriesHeading);
        const values = /\benum\b/.test(signature) && entriesTable ? nodes(entriesTable, (node) => node.tagName === 'a' && attribute(node, 'anchor-label') !== undefined).map((node) => attribute(node, 'anchor-label')!) : undefined;
        make(`${keyPath}:${name}`, name, /\benum\b/.test(signature) ? 'enum' : /\binterface\b/.test(signature) ? 'interface' : /\b(class|object)\b/.test(signature) ? 'class' : /\bfun\b/.test(signature) ? 'function' : 'property', signature, main, { throws: errors, parameters, values });
      }
    } else if (format === 'scaladoc') {
      const top = first(root, (node) => attribute(node, 'id') === 'signature');
      if (top && basename(path) !== 'index.html') make(`${keyPath}:type`, basename(path, '.html'), 'class', content(top), first(root, (node) => attribute(node, 'id') === 'comment') || root);
      for (const member of nodes(root, (node) => node.tagName === 'li' && attribute(node, 'name') !== undefined)) {
        const nativeName = attribute(member, 'name')!;
        if (!nativeName.includes('#') || /^(?:scala\.|java\.|_root_\.)/.test(nativeName) || attribute(member, 'visbl') === 'prt') continue;
        const symbol = first(member, (node) => cls(node, 'symbol')); if (!symbol) continue;
        const kind = content(first(member, (node) => cls(node, 'modifier_kind')));
        const value = `${kind} ${clean(codeText(symbol))}`;
        make(`${keyPath}:${nativeName}:${attribute(first(member, (node) => cls(node, 'anchorToMember')) || member, 'id')}`, nativeName, /\bnew\b/.test(kind) ? 'constructor' : /\bdef\b/.test(kind) ? 'method' : 'property', value, first(member, (node) => cls(node, 'fullcomment')) || member);
      }
    } else if (format === 'yard') {
      const title = first(root, (node) => node.tagName === 'h1');
      const overview = first(root, (node) => cls(node, 'docstring'));
      if (title && overview && /^(?:Class|Module):/.test(content(title))) {
        const name = content(title).replace(/^(?:Class|Module):\s*/, '');
        const body = { nodeName: '#document-fragment', childNodes: [overview, ...(nextElement(overview) ? [nextElement(overview)!] : [])] } as Html;
        make(`${keyPath}:type`, name, content(title).startsWith('Module') ? 'module' : 'class', `class ${name}`, body);
      }
      for (const detail of nodes(root, (node) => cls(node, 'method_details'))) {
        const signature = first(detail, (node) => cls(node, 'signature')); if (!signature) continue;
        const value = clean(codeText(signature)), name = content(first(signature, (node) => node.tagName === 'strong')) || value.match(/#([\w!?]+)/)?.[1];
        const parameters = nodes(detail, (node) => node.tagName === 'ul' && cls(node, 'param')).flatMap((ul) => nodes(ul, (node) => node.tagName === 'li')).map((li) => {
          const name = content(first(li, (node) => cls(node, 'name')));
          const all = content(li); return { name, type: all.match(/\(([^)]+)\)/)?.[1] || 'unknown', description: all.split(/[–—]/).slice(1).join('—').trim() };
        });
        const errors = nodes(detail, (node) => node.tagName === 'ul' && cls(node, 'raise')).flatMap((ul) => nodes(ul, (node) => node.tagName === 'li')).map((li) => ({ type: content(first(li, (node) => cls(node, 'type'))).replace(/^\(|\)$/g, '') || 'Error', description: content(li).split(/[–—]/).slice(1).join('—').trim() }));
        const isProperty = nodes(root, (node) => cls(node, 'attr_details')).some((container) => nodes(container, (node) => node === detail).length);
        // YARD's leading # is a receiver marker, not a Ruby comment. Present its
        // signature as Ruby syntax; retain the native return annotation separately.
        const declaration = isProperty ? `attr_accessor :${name}` : `def ${value.replace(/^[#+-]\s*/, '').split(/\s*⇒\s*/)[0].trim()}`;
        if (name) make(`${keyPath}:${attribute(signature, 'id') || name}`, name, isProperty ? 'property' : 'method', declaration, detail, { returnType: value.split(/\s*⇒\s*/)[1], ...(parameters.length ? { parameters: parameters.map((parameter) => ({ ...parameter, optional: value.includes(`${parameter.name} =`) })) } : {}), throws: errors });
      }
    } else if (format === 'ldoc') {
      const title = first(root, (node) => node.tagName === 'h2' && /^Module\b/.test(content(node)));
      if (title) make(`${keyPath}:module`, content(title).replace(/^Module\s*/, ''), 'module', `module ${content(title).replace(/^Module\s*/, '')}`, first(root, (node) => cls(node, 'summary')) || title);
      for (const dl of nodes(root, (node) => node.tagName === 'dl' && cls(node, 'function'))) for (const dt of (dl.childNodes || []).filter((node) => node.tagName === 'dt')) {
        const index = dl.childNodes!.indexOf(dt); const dd = dl.childNodes!.slice(index + 1).find((node) => node.tagName === 'dd'); if (!dd) continue;
        const parameters = nodes(dd, (node) => node.tagName === 'li' && Boolean(first(node, (el) => cls(el, 'parameter')))).map((li) => ({ name: content(first(li, (node) => cls(node, 'parameter'))), type: content(first(li, (node) => cls(node, 'types'))) || 'unknown', optional: /\bdefault\b|\boptional\b/.test(content(li)), description: content(li).replace(/^\S+\s+\S+\s*/, '') }));
        const returns = first(dd, (node) => node.tagName === 'ol');
        const children = dd.childNodes || []; const firstHeading = children.findIndex((node) => /^h[2-6]$/.test(node.tagName || ''));
        const summary = clean(children.slice(0, firstHeading < 0 ? children.length : firstHeading).map(codeText).join(''));
        const raises = children.findIndex((node) => /^h[2-6]$/.test(node.tagName || '') && /^raises?:?$/i.test(content(node)));
        const after = raises >= 0 ? children.slice(raises + 1) : []; const nextHeading = after.findIndex((node) => /^h[2-6]$/.test(node.tagName || ''));
        const errorText = clean(after.slice(0, nextHeading < 0 ? after.length : nextHeading).map(codeText).join(''));
        make(`${keyPath}:${content(dt)}`, content(dt).replace(/\(.*$/, ''), 'function', content(dt), dd, { summary, parameters, returnType: returns ? content(first(returns, (node) => cls(node, 'types'))) : undefined, returnsDoc: returns ? content(returns) : undefined, throws: errorText ? [{ type: 'error', description: errorText }] : [] });
      }
    } else if (format === 'exdoc') {
      const module = first(root, (node) => attribute(node, 'id') === 'moduledoc' || cls(node, 'moduledoc'));
      const heading = first(root, (node) => node.tagName === 'h1');
      if (module && heading) { const name = content(heading).replace(/\s*\([^)]*\)\s*$/, ''); make(`${keyPath}:module`, name, 'module', `defmodule ${name}`, module); }
      for (const section of nodes(root, (node) => cls(node, 'detail') && attribute(node, 'id') !== undefined)) {
        const signature = first(section, (node) => cls(node, 'signature')); if (!signature) continue;
        const spec = first(section, (node) => cls(node, 'specs'));
        const parameters = signatureParameters(clean(codeText(signature)), meta.language);
        const types = signatureParameters(clean(codeText(spec || htmlTree(''))), meta.language);
        parameters.forEach((p, index) => { if (types[index]) p.type = `${types[index].type === 'unknown' ? '' : `${types[index].type} `}${types[index].name}`; });
        make(`${keyPath}:${attribute(section, 'id')}`, clean(codeText(signature)), 'function', clean(codeText(spec || signature)), section, { parameters, returnType: clean(codeText(spec || htmlTree(''))).split('::')[1]?.trim() });
      }
    } else if (format === 'dartdoc') {
      const title = first(root, (node) => node.tagName === 'h1'); if (!title) continue;
      const kind = content(title).match(/\b(class|enum|method|constructor|property|function)\b/)?.[1]; if (!kind) continue;
      const name = content(title).replace(/ (class|enum|method|constructor|property|function).*$/, '');
      const signature = first(root, (node) => cls(node, 'multi-line-signature') || cls(node, 'signature'));
      if (!signature && kind !== 'enum') continue;
      const value = kind === 'enum' ? `enum ${name}` : clean(codeText(signature!));
      make(`${keyPath}:${name}`, name, kind, value, first(root, (node) => cls(node, 'desc')) || root, { returnType: ['method', 'function', 'property'].includes(kind) ? value.split(/\s+/)[0] : undefined, values: kind === 'enum' ? nodes(root, (node) => node.tagName === 'dt' && cls(node, 'constant') && attribute(node, 'id') !== 'values').map((node) => attribute(node, 'id')!).filter(Boolean) : undefined });
    }
  }
  return output;
}
const dirnamePath = (path: string) => path.split(sep).slice(0, -1).join(sep);

export function loadNativeSdk(config: SdkSourceConfig, meta: Meta): SDKDoc {
  const source = resolve(config.source);
  const extensions = ['typedoc', 'jsdoc', 'docc'].includes(config.adapter) ? ['.json'] : config.adapter === 'sphinx' ? ['.fjson'] : config.adapter === 'docfx' ? ['.yml', '.yaml'] : ['doxygen', 'phpdoc'].includes(config.adapter) ? ['.xml'] : config.adapter === 'godoc' ? ['.txt'] : ['.html'];
  let paths = artifactFiles(source, extensions, config);
  // Index/navigation pages are not API symbols. Do not re-import their summaries.
  if (extensions.includes('.html')) paths = paths.filter((path) => !/(?:^|\/)(?:src|static\.files|help-doc|legal|script-dir|lib|resource-files|search|index-files|class-use|jquery|assets)\//.test(path) && !/\/(?:package-summary|package-tree|overview-tree|allclasses-index|allpackages-index|help-doc|search|deprecated-list)\.html$/.test(path));
  const readers: Record<string, (paths: string[], meta: Meta) => NormalizedItem[]> = { typedoc, jsdoc, docfx, doxygen, phpdoc, docc, godoc };
  try {
    const items = readers[config.adapter] ? readers[config.adapter](paths, meta) : htmlSymbols(paths, config.adapter, meta, realpathSync(source));
    return finalize(items, meta);
  } catch (error) { throw new Error(`Could not ingest native ${config.adapter} source ${config.source}: ${error instanceof Error ? error.message : String(error)}`); }
}
