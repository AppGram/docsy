Authored articles let a Docsy site contain onboarding, concepts, tutorials, migration notes, and operational guides beside generated API and SDK reference pages.

The article body can be Markdown (`.md`) or native MDX (`.mdx`). YAML supplies route and presentation metadata. [Native MDX articles](../native-mdx) add built-in JSX components and optional trusted React modules without changing navigation, search, exports or permissions.

## Create the Markdown source

Create a file anywhere outside `public/`. Keeping authored content under `content/` makes the boundary obvious:

```text
content/
└── guides/
    └── authentication.md
```

Write the body as ordinary Markdown. The page title and description come from YAML, so the source can begin at level two:

````markdown
Use a bearer token when calling protected endpoints.

## Create a token

Open the dashboard and create a token for the target environment.

## Send a request

```bash
curl https://api.example.com/me \
  --header 'Authorization: Bearer <token>'
```
````

Docsy renders headings, links, lists, blockquotes, tables, inline code, fenced code blocks, and trusted inline HTML. Level-two and level-three headings populate the right-hand table of contents.

## Register the article in YAML

Add the source to `content.articles`:

```yaml
content:
  articles:
    - slug: authentication
      source: content/guides/authentication.md
      title: Authentication
      description: Create a token and authenticate API requests.
      eyebrow: GUIDE
```

The `slug` becomes `/guides/authentication`. Nested slugs create nested URLs:

```yaml
- slug: platform/security/authentication
  source: content/guides/authentication.md
  title: Authentication
```

That article is served at `/guides/platform/security/authentication` underneath `site.basePath`.

## Place it in navigation

Registration creates the route. Navigation is explicit so you control grouping and order:

```yaml
content:
  articles:
    - { slug: platform, title: Platform, source: content/platform/index.md }
    - { slug: platform/security, title: Security, source: content/platform/security/index.md }
    - { slug: platform/security/authentication, title: Authentication, source: content/platform/security/authentication/index.mdx }
    - { slug: platform/security/authentication/tokens/rotation, title: Token rotation, source: content/platform/security/authentication/tokens/rotation.mdx }

navigation:
  - title: Platform
    items:
      - title: Overview
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

Navigation entries do not create pages by themselves. Their `href` must point to an authored article, API section, SDK page, or Astro route that exists.

### Deep documentation trees

**Available since Docsy 0.4.6.** Earlier versions accepted nested slugs and recursive YAML, but the sidebar only rendered two levels. See the [nested documentation tutorial](../nested-documentation) for setup and upgrade notes.

Repeat `items` at any level; the sidebar is recursive, not limited to children or grandchildren. Each branch can be expanded or collapsed with its chevron or keyboard. Opening a deep URL expands its ancestors automatically; only the current page is highlighted. Indentation stops growing after five steps so very deep titles still fit the sidebar, without flattening or dropping the underlying tree.

Source folders, URL segments and navigation nesting are independent. A source may live many directories down, a slug may contain many `/` segments, and a sidebar parent does not have to share its children's URL prefix. Include `site.basePath` only in site configuration, not in these `href` values. Register every linked parent page too; intermediate URL segments do not need pages unless you link to them.

Nested Markdown and MDX pages retain full-text search, heading links, Markdown/JSON exports, version/language routing and lock-mode rules. The overview's Markdown export includes the nested link hierarchy and filters restricted links at every level. Docsy has regression coverage for ten-level rendered sites and 32-level YAML navigation. The YAML parser's nesting safety limit remains enabled; normal browser, URL and filesystem limits also apply.

Canonical Markdown exports end in `.md`, for example `/format-md/guides/platform.md` and `/format-md/guides/platform/security.md`. This avoids static-file collisions when both a parent and its descendants are documents. Use the Markdown menu or each search/JSON record's `markdownUrl`. Existing extensionless exports remain available at runtime and for static pages that are not parents of another export.

## Credit writers and let readers correct a page

Register reusable profiles under `authors`, then reference their IDs in each article's `authors`, `contributors` or `reviewedBy` arrays. Human, organization and coding-agent profiles are supported. Publication/update/review dates and optional agent provenance are explicit YAML metadata, not inferred from Git commits or build dates.

Set `reader.editUrl` to your repository's edit URL template to show an **Edit this page** button. An article's `editUrl: false` disables it for that page, or a page-specific URL overrides the template. Author GitHub profiles and the documentation repository are separate settings.

See [Authors, reviews and edit links](../authors-and-edit-links) for complete YAML examples, optional agent/model references, and export/privacy behavior.

## Search and Markdown export

Registered articles automatically participate in:

- Full-site search, including article headings.
- The on-page heading rail.
- `?format=md` and `/format-md/...` exports for agents and LLM tools.
- Lock-mode rules and search-result filtering.

For example, `/docs/guides/authentication?format=md` resolves to the article's Markdown export when the site uses `/docs` as its base path.

## Protect an article

Authored articles use the same access rules as generated reference pages:

```yaml
access:
  mode: locked
  rules:
    - pattern: /guides/internal/**
      tiers: [enterprise]
```

Keep protected Markdown outside `public/`. Files in `public/` are static assets and bypass request-time permission checks.

Next: [ingest an OpenAPI document](../openapi-ingestion).
