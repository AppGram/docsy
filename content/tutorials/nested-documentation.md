:::note[Available since Docsy 0.4.6]
Fully recursive sidebar navigation and collision-free static Markdown exports for parent/child articles are available from **0.4.6**. Older versions accepted nested article slugs, but their sidebar stopped rendering after two levels.
:::

## Register parent and child articles

Merge these entries into your existing `docsy.config.yaml`. Create the referenced Markdown or MDX files outside `public/`; registration creates each page, while navigation controls where readers find it.

```yaml
content:
  articles:
    - slug: platform
      title: Platform
      source: content/platform/index.md
    - slug: platform/security
      title: Security
      source: content/platform/security/index.md
    - slug: platform/security/authentication
      title: Authentication
      source: content/platform/security/authentication/index.mdx
    - slug: platform/security/authentication/tokens/rotation
      title: Token rotation
      source: content/platform/security/authentication/tokens/rotation.mdx

navigation:
  - title: Platform documentation
    items:
      - title: Platform
        href: /guides/platform
        items:
          - title: Security
            href: /guides/platform/security
            icon: lucide:shield
            items:
              - title: Authentication
                href: /guides/platform/security/authentication
                items:
                  - title: Token rotation
                    href: /guides/platform/security/authentication/tokens/rotation
```

Continue adding `items` lists for deeper trees. Every navigation entry needs an `href` to an existing page; a navigation entry alone does not create a page. The intermediate `tokens` URL segment above does not need its own article unless you link to it.

## Understand the three hierarchies

Source folders, URL paths and sidebar nesting are independent:

- `source` selects a file. It can live several directories down and can be `.md` or `.mdx`.
- `slug` creates the URL under `/guides/`. With `site.basePath: /docs`, the example leaf is `/docs/guides/platform/security/authentication/tokens/rotation`.
- Nested navigation `items` determine the reading hierarchy. A parent can link to a page whose URL prefix differs from its descendants.

Do not repeat `site.basePath` in navigation `href` values. Icons and localized `titles` work at every level.

## Browse deep trees

Branches expand automatically to the current page. Click a branch's chevron, or focus its summary and press Enter or Space, to expand or collapse it without navigating. The title link opens the branch's own page.

Only the current page is highlighted. Ancestors remain expanded and readable. Visual indentation stops increasing after five steps to keep deep labels inside narrow sidebars; the actual tree, routes and child pages remain intact. The controls use the existing fonts and light/dark palette, not a new font or icon service.

Regression tests cover ten-level rendered sites and 32-level YAML navigation. This is not a promise of infinite depth: the YAML parser's nesting safety limit stays enabled, and browser, URL and filesystem limits still apply.

## Retrieve parent and child pages as Markdown

Since **0.4.6**, canonical Markdown URLs end in `.md`:

```text
/docs/format-md/guides/platform.md
/docs/format-md/guides/platform/security.md
/docs/format-md/guides/platform/security/authentication/tokens/rotation.md
```

The suffix prevents a parent export from being both a static file and a directory containing its descendants. The Markdown menu, `?format=md`, search records, JSON documents and `llms.txt` point to the canonical URLs. Agents should follow each record's `markdownUrl` rather than constructing one manually.

Existing extensionless exports remain available at runtime and for non-conflicting static pages. On static hosting, an extensionless parent path cannot also hold child exports: use its `.md` URL. JSON page exports keep their existing `.json` URLs.

## Keep versions, search and permissions

Nested pages participate in full-text search, heading links, version/language routing and Markdown/JSON exports. The overview's Markdown export preserves nested links and filters restricted links at every level. Standard version and locale registrations still apply; nesting does not automatically translate articles.

Protect an entire deep subtree with the existing ordered access rules:

```yaml
access:
  mode: locked
  tiers:
    enterprise:
      label: Enterprise
  rules:
    - pattern: /guides/platform/security
      tiers: [enterprise]
    - pattern: /guides/platform/security/**
      tiers: [enterprise]
```

The first rule protects the parent page; `**` in the second rule spans its nested descendants. Unmatched routes remain public. These rules apply to HTML, Markdown and JSON retrieval across version/language variants. Locked mode requires the Node/Bun runtime behind a trusted authentication integration; static hosts cannot enforce tiers. Keep protected content out of `public/`.

## Upgrade an existing generated site

New sites generated from `@appgram/docsy@0.4.6` include the feature. Existing sites own a copy of their source, so upgrading the CLI alone does not change them. Generate a fresh 0.4.6 baseline and use the [non-destructive upgrade comparison](../../reference/upgrading) to review the template changes while preserving your YAML, articles and UI customizations.

Run `npm run validate` and `npm run build`, then reload a deep URL directly and check its HTML, search and `.md`/JSON exports. For locked sites, test both anonymous and authorized requests before deploying.
