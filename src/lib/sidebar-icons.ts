import { z } from 'zod';
import { icons as lucide } from '@iconify-json/lucide';
import { icons as tabler } from '@iconify-json/tabler';
import { getIconData, iconToHTML, iconToSVG } from '@iconify/utils';

// Build/server-only data: no Iconify browser component, API, font or CDN.
const packs = { lucide, tabler };
export const SIDEBAR_ICON_PACKS = ['lucide', 'tabler'] as const;
const nameSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const packReference = /^([a-z0-9-]+):([a-z0-9-]+)$/;
const validAsset = (value: string): boolean => {
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { return false; }
  if (/[\u0000-\u0020<>"'\\]/.test(decoded) || decoded.startsWith('//')) return false;
  if (/^https?:\/\//i.test(value)) {
    try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
  }
  return !/^[^/]*:/.test(value) && !decoded.split(/[/?#]/).includes('..')
    && /\.(?:svg|png|jpe?g|webp|avif|gif|ico)$/i.test(value.split(/[?#]/)[0]);
};
const assetSchema = z.string().trim().min(1).refine(validAsset, 'Use a local SVG/PNG/image asset or an explicit HTTP(S) image URL');
const hasIcon = (pack: string, name: string): boolean => Object.hasOwn(packs, pack)
  && Boolean(getIconData(packs[pack as keyof typeof packs], name));
const shortSchema = z.string().trim().min(1).superRefine((value, context) => {
  const reference = value.match(packReference);
  if (reference) {
    if (!hasIcon(reference[1], reference[2])) context.addIssue({ code: 'custom', message: `Unknown sidebar icon "${value}". Use an existing lucide:name or tabler:name, or a custom image asset.` });
  } else if (!validAsset(value)) context.addIssue({ code: 'custom', message: 'Use lucide:name, tabler:name or a safe image asset path; raw SVG and executable URLs are not supported.' });
});
export const sidebarIconSchema = z.union([
  shortSchema,
  z.literal(false),
  z.object({ pack: z.enum(SIDEBAR_ICON_PACKS), name: nameSchema }).strict().superRefine((value, context) => {
    if (!hasIcon(value.pack, value.name)) context.addIssue({ code: 'custom', path: ['name'], message: `Unknown ${value.pack} icon "${value.name}"` });
  }),
  z.object({ src: assetSchema, darkSrc: assetSchema.optional(), mode: z.enum(['image', 'mask']).optional() }).strict(),
]);
export type SidebarIconConfig = z.infer<typeof sidebarIconSchema>;
export type SidebarIconView = { src: string; darkSrc?: string; mode: 'image' | 'mask'; reference?: string };
const rendered = new Map<string, string>();
function packIcon(pack: keyof typeof packs, name: string): SidebarIconView {
  const reference = `${pack}:${name}`;
  if (!rendered.has(reference)) {
    const data = getIconData(packs[pack], name);
    if (!data) throw new Error(`Unknown sidebar icon "${reference}"`);
    const { body, attributes } = iconToSVG(data, { height: 24 });
    // An inert SVG image used as a CSS mask, never arbitrary inline markup.
    rendered.set(reference, `data:image/svg+xml,${encodeURIComponent(iconToHTML(body, { ...attributes, color: 'black' }))}`);
  }
  return { src: rendered.get(reference)!, mode: 'mask', reference };
}
export function resolveSidebarIcon(icon: SidebarIconConfig | undefined, assetPath: (path: string) => string): SidebarIconView | undefined {
  if (!icon) return undefined;
  if (typeof icon === 'string') {
    const reference = icon.match(packReference);
    return reference ? packIcon(reference[1] as keyof typeof packs, reference[2]) : { src: assetPath(icon), mode: 'image' };
  }
  if ('pack' in icon) return packIcon(icon.pack, icon.name);
  return { src: assetPath(icon.src), darkSrc: icon.darkSrc ? assetPath(icon.darkSrc) : undefined, mode: icon.mode ?? 'image' };
}
