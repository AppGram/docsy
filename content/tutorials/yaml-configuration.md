Docsy treats `docsy.config.yaml` as the durable source of truth for a documentation site. Change YAML when you are changing the product, content wiring, navigation, theme, ingestion sources, or access policy. Change Astro and CSS only when you are changing interface behavior or layout.

## How configuration becomes a site

Every development server and production build follows the same path:

1. Read `docsy.config.yaml`, or the file named by `DOCSY_CONFIG`.
2. Expand environment placeholders such as `${DOCSY_ORIGIN:-http://localhost:4321}`.
3. Validate the result against Docsy's schema.
4. Load authored Markdown, OpenAPI, and SDK sources.
5. Build routes, navigation, search, Markdown exports, and access rules.

An invalid value stops the build with its exact YAML path. Run this before committing a change:

```bash
npm run validate
```

## The top-level sections

| Section | Responsibility |
| --- | --- |
| `site` | Product identity, canonical origin, mount path, logo, and metadata |
| `header` | Search copy, Markdown label, and an optional call to action |
| `eyebrow` | Page marker: custom SVG/image, original triangle, or none, plus icon size |
| `theme` | Light or dark mode, colors, and system font stacks |
| `home` | Landing-page copy, actions, optional image, and `articleLayout` (`grid` or `list`) |
| `content.articles` | Authored Markdown pages rendered under `/guides/` |
| `authors` | Reusable human, organization and coding-agent profiles referenced by articles |
| `reader` | Heading links, byline visibility, default/unknown author pictures, and optional edit/report links |
| `content.components` / `content.snippets` | Enabled rich components and named reusable Markdown |
| `content.media` | Enable the fullscreen image/video viewer, or switch images/videos off independently |
| `versions` / `localization` | Documentation contexts, locale routing, fallbacks, and UI messages |
| `search` | Full-text reader search and result limits |
| `agent` | JSON/Markdown discovery and an optional runtime query API |
| `validation` | API-contract/example checks and internal links/anchors |
| `navigation` | Sidebar groups and links |
| `ingestion` | OpenAPI and SDK metadata sources |
| `access` | Open or locked mode, tiers, providers, and ordered rules |
| `maintenance` | Watched source paths, editable Markdown, migration notes, and the coding agent's optional model |

The minimum useful configuration connects these responsibilities rather than duplicating them:

```yaml
site:
  name: Acme API
  title: Acme API Documentation
  description: Build against the Acme platform.
  origin: ${DOCSY_ORIGIN:-http://localhost:4321}
  basePath: /docs
  logo: assets/acme-mark.svg

home:
  title: Build with Acme.
  description: Guides and reference documentation for the Acme API.
  primaryAction:
    label: Start building →
    href: /guides/getting-started

content:
  articles:
    - slug: getting-started
      source: content/getting-started.md
      title: Getting started
      description: Make your first authenticated request.

navigation:
  - title: Guides
    items:
      - title: Getting started
        href: /guides/getting-started

access:
  mode: open

ingestion:
  sdks: []
  openapi:
    source: sources/openapi.yaml
    apiBaseUrl: https://api.example.com
    sections: []
```

## Paths and environment values

`site.basePath` is the public mount point. With `/docs`, an article route such as `/guides/getting-started` is served at `/docs/guides/getting-started`. Keep navigation links relative to the documentation root; Docsy adds the mount path.

Use environment interpolation for deployment-specific values:

```yaml
site:
  origin: ${DOCSY_ORIGIN:-http://localhost:4321}
```

`${NAME}` requires the variable. `${NAME:-fallback}` supplies a development default.

To maintain separate configurations without copying source code, select one at build time:

```bash
DOCSY_CONFIG=docsy.enterprise.yaml npm run build
```

## What YAML does not own

YAML intentionally does not describe arbitrary layout. The generated Astro components and CSS remain in the repository for deeper changes. This split keeps routine configuration safe while preserving full source ownership.

Next: [write authored documentation](../authored-articles).
