import { assetPath, docsPath, docsyConfig } from '../config';

export type DocsNavItem = {
  title: string;
  href: string;
  icon?: string;
  items?: DocsNavItem[];
};

export type DocsNavSection = {
  title: string;
  items: DocsNavItem[];
};

const normalizeItem = (item: (typeof docsyConfig.navigation)[number]['items'][number]): DocsNavItem => ({
  title: item.title,
  href: docsPath(item.href),
  icon: item.icon ? assetPath(item.icon) : undefined,
  items: item.items?.map(normalizeItem),
});

export const docsNav: DocsNavSection[] = docsyConfig.navigation.map((section) => ({
  title: section.title,
  items: section.items.map(normalizeItem),
}));

export const isNavItemActive = (item: DocsNavItem, pathname: string): boolean => {
  const cleanPath = pathname.replace(/\/$/, '') || '/';
  const cleanHref = item.href.replace(/\/$/, '') || '/';
  if (cleanHref === cleanPath) return true;
  if (item.items?.some((sub) => isNavItemActive(sub, cleanPath))) return true;
  if (cleanHref !== docsPath() && cleanPath.startsWith(`${cleanHref}/`)) return true;
  return false;
};
