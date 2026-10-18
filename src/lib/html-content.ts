import { parseFragment } from 'parse5';

type Node = { nodeName: string; tagName?: string; value?: string; attrs?: { name: string; value: string }[]; childNodes?: Node[] };
export const htmlTree = (html: string) => parseFragment(html) as unknown as Node;
export const attribute = (node: Node, name: string) => node.attrs?.find((attr) => attr.name === name)?.value;
export const walkHtml = (node: Node, visit: (node: Node) => void) => { visit(node); node.childNodes?.forEach((child) => walkHtml(child, visit)); };
export const textContent = (node: Node): string => ['script', 'style'].includes(node.tagName ?? '') ? '' : node.nodeName === '#text' ? node.value ?? '' : (node.childNodes ?? []).map(textContent).join(['code', 'span', 'strong', 'em', 'a'].includes(node.tagName ?? '') ? '' : ' ');
export function extractHtml(html: string) {
  const root = htmlTree(html);
  const ids = new Set<string>(); const links: string[] = [];
  walkHtml(root, (node) => {
    const id = attribute(node, 'id'); if (id) ids.add(id);
    const href = attribute(node, ['img', 'script', 'source', 'video', 'audio'].includes(node.tagName ?? '') ? 'src' : 'href');
    if (href) links.push(href);
  });
  return { text: textContent(root).replace(/\s+/g, ' ').trim(), ids, links };
}

export function htmlSections(html: string): { title: string; id: string; text: string }[] {
  const sections = [{ title: '', id: '', text: '' }];
  const visit = (node: Node) => {
    if (node.tagName && /^h[23]$/.test(node.tagName)) {
      sections.push({ title: textContent(node).trim(), id: attribute(node, 'id') ?? '', text: '' }); return;
    }
    if (node.nodeName === '#text') sections.at(-1)!.text += ` ${node.value ?? ''}`;
    else if (!['script', 'style'].includes(node.tagName ?? '')) node.childNodes?.forEach(visit);
  };
  visit(htmlTree(html));
  return sections.map((section) => ({ ...section, text: section.text.replace(/\s+/g, ' ').trim() }));
}
