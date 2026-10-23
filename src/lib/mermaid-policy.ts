// Shared by build-time fence handling and the local browser renderer. Authors
// supply diagram notation, never renderer configuration, URLs or executable JS.
export function validateMermaidSource(source: string, maxTextSize = 50000): void {
  if (!source.trim()) throw new Error('Mermaid diagrams must not be empty.');
  if (source.length > maxTextSize) throw new Error(`Mermaid diagram exceeds content.mermaid.maxTextSize (${maxTextSize}).`);
  if (/%%\s*\{|^\s*---(?:\r?\n|$)/.test(source)) throw new Error('Mermaid configuration directives/frontmatter are disabled. Use content.mermaid in YAML.');
  // Decode numeric/common entities before checking resource references, including
  // nested ampersands. This also prevents entity-obfuscated image/font URLs.
  let decoded = source;
  for (let pass = 0; pass < 5; pass++) decoded = decoded.replace(/&(?:#(x[0-9a-f]+|\d+)|(amp|colon|sol|bsol|Tab|NewLine));?/gi, (match, number, name) => {
    if (number) { const point = Number.parseInt(number.replace(/^x/i, ''), /^x/i.test(number) ? 16 : 10); return point <= 0x10ffff ? String.fromCodePoint(point) : match; }
    return ({ amp: '&', colon: ':', sol: '/', bsol: '\\', tab: '\t', newline: '\n' } as Record<string, string>)[name.toLowerCase()];
  });
  const compact = decoded.replace(/[\u0000-\u0020]/g, '');
  if (/(?:https?|ftp|data|javascript|vbscript):|\/\/|url\(|@import|@font-face|font-family:|\\[0-9a-f]{1,6}/i.test(compact)) throw new Error('Mermaid diagrams must not load resources, URLs or fonts. Use local PlantUML/draw.io exports for image-based diagrams.');
}
