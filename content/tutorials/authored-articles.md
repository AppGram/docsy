Authored articles let a Docsy site contain onboarding, concepts, tutorials, migration notes, and operational guides beside generated API and SDK reference pages.

The article body is Markdown. YAML supplies route and presentation metadata.

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
navigation:
  - title: Platform
    items:
      - title: Security
        href: /guides/platform/security/authentication
        items:
          - title: Authentication
            href: /guides/platform/security/authentication
```

Navigation entries do not create pages by themselves. Their `href` must point to an authored article, API section, SDK page, or Astro route that exists.

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
