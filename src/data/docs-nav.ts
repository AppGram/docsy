import { assetPath, defaultContext, docsPath, docsyConfig, parseDocsPath, type DocsContext } from '../config';
import { findArticle } from '../lib/article-loader';
import { resolveSidebarIcon, type SidebarIconView } from '../lib/sidebar-icons';

export type DocsNavItem = {
  title: string;
  href: string;
  icon?: SidebarIconView;
  items?: DocsNavItem[];
};

export type DocsNavSection = {
  title: string;
  icon?: SidebarIconView;
  items: DocsNavItem[];
};

const isAvailable = (href: string, context: DocsContext): boolean => {
  const path = href.split(/[?#]/)[0];
  return !path.startsWith('/guides/') || Boolean(findArticle(path.slice(8), context));
};

const normalizeItem = (item: (typeof docsyConfig.navigation)[number]['items'][number], context: DocsContext): DocsNavItem => ({
  title: item.titles?.[context.locale] ?? item.title,
  href: docsPath(item.href, context),
  icon: resolveSidebarIcon(item.icon, assetPath),
  items: item.items?.filter((child) => isAvailable(child.href, context)).map((child) => normalizeItem(child, context)),
});

export const getDocsNav = (context: DocsContext = defaultContext): DocsNavSection[] => docsyConfig.navigation.map((section) => ({
  title: section.titles?.[context.locale] ?? section.title,
  icon: resolveSidebarIcon(section.icon, assetPath),
  items: section.items.filter((item) => isAvailable(item.href, context)).map((item) => normalizeItem(item, context)),
})).filter((section) => section.items.length);
export const docsNav = getDocsNav();

const navPath = (href: string): string => href.split(/[?#]/)[0].replace(/\/+$/, '') || '/';

export const isNavItemCurrent = (item: DocsNavItem, pathname: string): boolean =>
  !item.href.includes('#') && navPath(item.href) === navPath(pathname);

export const isNavItemActive = (item: DocsNavItem, pathname: string): boolean => {
  const cleanPath = navPath(pathname);
  const cleanHref = navPath(item.href);
  if (cleanHref === cleanPath) return true;
  if (item.items?.some((sub) => isNavItemActive(sub, cleanPath))) return true;
  if (parseDocsPath(cleanHref)?.path !== '/' && cleanPath.startsWith(`${cleanHref}/`)) return true;
  return false;
};
