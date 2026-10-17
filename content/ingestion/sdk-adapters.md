Docsy can render SDK reference pages from documentation metadata produced by several language ecosystems. Each adapter converts its source into one normalized category-and-symbol model, so the default interface stays consistent across SDKs.

## Supported adapters

| Adapter | Intended input |
| --- | --- |
| `typedoc` | Standard TypeDoc JSON output |
| `typedoc-lite` | A compact category-and-item JSON format |
| `swift-symbols` | Swift symbol graph-derived JSON |
| `dartdoc` | Dart documentation metadata JSON |

Sources may be project-relative files or HTTPS URLs. Local files make builds deterministic and are appropriate for private metadata.

## Register an SDK

Add an entry to `ingestion.sdks`:

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
      icon: assets/sdks/javascript.svg
```

The SDK is rendered at `/javascript-sdk` beneath `site.basePath`.

## Add it to navigation

Routes and navigation are intentionally separate. Register the route under `ingestion.sdks`, then place it where readers should find it:

```yaml
navigation:
  - title: SDKs
    items:
      - title: JavaScript
        href: /javascript-sdk
        icon: assets/sdks/javascript.svg
```

The page automatically participates in full-site search and Markdown export.

## Use the compact TypeDoc format

The `typedoc-lite` adapter accepts a small JSON document when standard TypeDoc output is unnecessary:

```json
{
  "overview": "Typed client for the Acme API.",
  "categories": [
    {
      "name": "Client",
      "items": [
        {
          "name": "createClient",
          "kind": "function",
          "signature": "createClient(options: ClientOptions): Client",
          "description": "Create a configured API client."
        }
      ]
    }
  ]
}
```

Use standard TypeDoc when the upstream tool already produces complete metadata. Use the compact format when another build process or coding agent is creating the source deliberately.

## Protect private SDK reference

SDK pages use the same ordered lock-mode rules as articles and API pages:

```yaml
access:
  mode: locked
  rules:
    - pattern: /javascript-sdk
      tiers: [developer, enterprise]
```

Keep protected source JSON outside `public/`. Static files under `public/` bypass request-time authorization.

