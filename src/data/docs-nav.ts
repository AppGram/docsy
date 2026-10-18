import { assetPath, defaultContext, docsPath, docsyConfig, parseDocsPath, type DocsContext } from '../config';
import { findArticle } from '../lib/article-loader';

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

const normalizeItem = (item: (typeof docsyConfig.navigation)[number]['items'][number], context: DocsContext): DocsNavItem => ({
  title: item.titles?.[context.locale] ?? item.title,
  href: docsPath(item.href, context),
  icon: item.icon ? assetPath(item.icon) : undefined,
  items: item.items?.filter((child) => !child.href.startsWith('/guides/') || findArticle(child.href.slice(8), context)).map((child) => normalizeItem(child, context)),
});

export const getDocsNav = (context: DocsContext = defaultContext): DocsNavSection[] => docsyConfig.navigation.map((section) => ({
  title: section.titles?.[context.locale] ?? section.title,
  items: section.items.filter((item) => !item.href.startsWith('/guides/') || findArticle(item.href.slice(8), context)).map((item) => normalizeItem(item, context)),
})).filter((section) => section.items.length);
export const docsNav = getDocsNav();

export const isNavItemActive = (item: DocsNavItem, pathname: string): boolean => {
  const cleanPath = pathname.replace(/\/$/, '') || '/';
  const cleanHref = item.href.replace(/\/$/, '') || '/';
  if (cleanHref === cleanPath) return true;
  if (item.items?.some((sub) => isNavItemActive(sub, cleanPath))) return true;
  if (parseDocsPath(cleanHref)?.path !== '/' && cleanPath.startsWith(`${cleanHref}/`)) return true;
  return false;
};
