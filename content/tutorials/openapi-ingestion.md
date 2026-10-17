Docsy converts Swagger 2 or OpenAPI 3 documents into normalized endpoint pages, navigation targets, search entries, request examples, response examples, and Markdown exports.

## Choose a source

Use a project-relative JSON or YAML file for deterministic and private builds:

```yaml
ingestion:
  openapi:
    enabled: true
    source: sources/openapi.yaml
    apiBaseUrl: https://api.example.com
```

Or fetch a public document during the build:

```yaml
ingestion:
  openapi:
    enabled: true
    source: https://api.example.com/openapi.json
    apiBaseUrl: https://api.example.com
```

`source` tells Docsy where the description lives. `apiBaseUrl` is the request origin used in generated curl examples.

## Group endpoints into pages

Each entry in `sections` creates `/api/<section>`:

```yaml
ingestion:
  openapi:
    enabled: true
    source: sources/openapi.yaml
    apiBaseUrl: https://api.example.com
    guide:
      label: Authentication guide
      href: /guides/authentication
    sections:
      - section: users
        title: Users
        description: Create and manage users.
        tags: [users]
        paths: [/v1/users]
      - section: billing
        title: Billing
        description: Subscriptions, invoices, and payment methods.
        tags: [billing]
        paths: [/v1/invoices, /v1/subscriptions]
```

Matching is case-insensitive. An operation belongs to a section when either:

- One of its OpenAPI tags contains a configured `tags` value.
- Its path contains a configured `paths` value.

Use specific values when sections overlap. An operation can appear in more than one section when it matches more than one rule.

## Add pages to navigation

Sections create routes; navigation controls discovery and order:

```yaml
navigation:
  - title: API Reference
    items:
      - title: Users
        href: /api/users
      - title: Billing
        href: /api/billing
```

## Add SDK reference sources

SDK adapters normalize external documentation metadata into the same rendered model:

```yaml
ingestion:
  sdks:
    - id: javascript
      slug: javascript-sdk
      adapter: typedoc
      source: sources/javascript/docs.json
      name: JavaScript SDK
      language: typescript
      install: npm install @acme/sdk
      overview: Typed client for the Acme API.
  openapi:
    enabled: true
    source: sources/openapi.yaml
    apiBaseUrl: https://api.example.com
    sections: []
```

Available adapters are `typedoc`, `typedoc-lite`, `swift-symbols`, and `dartdoc`. Source paths are resolved from the project root.

## Keep protected sources private

Commit private or air-gapped input beneath `sources/`, or provide it during the build. Never place a protected OpenAPI or SDK source under `public/`; public assets are served without lock-mode checks.

Next: [protect documentation by tier](../lock-mode).
