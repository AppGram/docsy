Docsy can render SDK reference pages from documentation metadata produced by several language ecosystems. Each adapter converts its source into one normalized category-and-symbol model, so the default interface stays consistent across SDKs.

## Supported adapters

| Adapter | Intended input |
| --- | --- |
| `typedoc` | TypeDoc project JSON, including nested modules/members, signatures, parameters, examples, enums, and properties |
| `jsdoc` | JSDoc `-X` doclet JSON for JavaScript |
| `sphinx` | Sphinx JSON-builder directory containing `.fjson` API definitions |
| `javadoc` | Standard Javadoc HTML directory |
| `dokka` | Dokka HTML directory for Kotlin |
| `scaladoc` | Scaladoc 2 HTML directory |
| `docfx` | ManagedReference YAML from C#/F#/VB assemblies and compiler XML comments |
| `doxygen` | Doxygen XML directory, tested with C, C++, and Objective-C |
| `godoc` | Plain-text output from `go doc -all` |
| `rustdoc` | Stable rustdoc HTML directory, not nightly JSON |
| `docc` | Swift DocC archive/data directory containing render-node JSON |
| `phpdoc` | phpDocumentor XML `structure.xml` |
| `yard` | YARD HTML directory for Ruby |
| `exdoc` | ExDoc HTML directory for Elixir |
| `ldoc` | LDoc HTML directory for Lua |
| `typedoc-lite` | Docsy's compact `modules` + `navigation` JSON; declarations, parameters, properties, methods, enum values, and examples |
| `swift-symbols` | [AppGram/docc2json](https://github.com/AppGram/docc2json) output: Swift types, protocols, enums, and navigation |
| `dartdoc` | Native Dartdoc HTML directory with signatures and members; legacy flat JSON index remains supported |

SDK sources are local, project-relative files or artifact directories. Unlike the OpenAPI loader, SDK adapters do not fetch HTTPS URLs or extract archives. Generate or download artifacts into your repository before building. Keep private inputs outside `public/`. Generators are never executed as a side effect of reading YAML or building Docsy.

:::note[Native coverage is tested against real generator output]
The portal's native samples cover 20 source languages across 16 native formats. The original generator outputs, source code, tool versions, commands, and hashes are committed under `sources/native/` and `tests/generators/`. The separate compact format is still useful, but does not count as native language support. Pdoc and raw C# compiler XML alone are not direct adapters; use Sphinx or DocFX artifacts respectively.
:::

The **Native SDK samples** section contains the generated reference pages. See **Explore SDK samples** for reproduction commands and format-specific limitations.

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
      installLanguage: bash
      overview: Typed client for the Acme API.
      icon: assets/sdks/javascript.svg
      quickstart:
        language: typescript
        code: |
          import { createClient } from '@acme/sdk';
          const client = createClient();
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

The page automatically participates in full-text search, the overview catalog, Markdown export, and agent JSON. `quickstart` is authored in YAML, not extracted from the SDK source. Its language defaults to the SDK's `language`; `installLanguage` controls the install block. Neither block is executed during ingestion.

Native examples are different: the importer reads code blocks from generator comments/artifacts and places them beside their symbol declarations. Remarks, optional arguments, enum values, properties, deprecations, and documented errors are retained where the adapter exposes them. [Explore the richer 20-language samples](/guides/ingestion/sdk-samples) for the exact content of each fixture and remaining limitations. `icon` and optional `iconDark` choose local SVG branding for both SDK cards and reference headings; they do not affect ingestion.

## Use the compact TypeDoc format

The `typedoc-lite` adapter accepts a small JSON document when standard TypeDoc output is unnecessary:

```json
{
  "modules": [
    {
      "name": "AcmeSDK",
      "types": [
        {
          "name": "createClient",
          "kind": "function",
          "declaration": "declare function createClient(baseUrl: string): Client;",
          "parameters": [{ "name": "baseUrl", "type": "string" }],
          "returnType": "Client",
          "description": {
            "summary": "Create a configured API client.",
            "example": "const client = createClient('https://api.example.com');"
          }
        }
      ]
    }
  ],
  "navigation": {
    "categories": [{ "title": "Functions", "items": ["createClient"] }]
  }
}
```

Use standard TypeDoc when the upstream tool already produces complete metadata. Use the compact format when another build process or coding agent is creating the source deliberately.

The compact adapter currently reads the first module. Category `items` must reference names from that module's `types`. Set `language: python`, `rust`, `csharp`, or `kotlin` in YAML to render declarations and examples in another language without changing the compact schema.

## Swift through AppGram/docc2json

Swift documentation is supported through [AppGram/docc2json](https://github.com/AppGram/docc2json). The converter reads an existing DocC archive or processed `docs/data` folder and produces the JSON schema consumed by Docsy's `swift-symbols` adapter.

```text
Existing DocC archive → AppGram/docc2json → SDK JSON → Docsy swift-symbols
```

With the converter installed, use an archive you have already generated:

```bash
docc2json --input ./AtlasSDK.doccarchive \
  --output ./sources/atlas-swift.json \
  --public-only
```

Alternatively, pass `--input ./docs/data` for a processed DocC data folder. Then register its output:

```yaml
ingestion:
  sdks:
    - id: swift
      slug: swift-sdk
      adapter: swift-symbols
      source: sources/atlas-swift.json
      name: Atlas Swift SDK
      language: swift
      install: '.package(path: "../AtlasSDK")'
      installLanguage: swift
      overview: Swift API reference generated with AppGram/docc2json.
```

The adapter reads the first module's `types`, `protocols`, and `enums`, with category item names in `navigation.categories`. Descriptions use `abstract`, examples use `examples[].code`, and method parameters live under `signature.parameters`. Protocol method requirements use `requirements` with `kind: func` or `method`; their async flag comes from `signature.async`.

Docsy consumes the generated JSON; it does not run the Swift documentation build or the converter for you. Raw `.symbols.json` and `.doccarchive` paths are not direct inputs to `swift-symbols`—the supported converter bridges those formats. You can build the portal from checked-in converter output without Xcode.

The portal's Swift page now uses actual DocC render-node output through the direct `docc` adapter. The older `swift-symbols` regression fixture remains a hand-authored schema fixture and is not counted as native coverage. That converter adapter still renders a subset of docc2json output; module articles, extensions, associated types, and conformance relationships are not fully imported into its SDK view.

## Dart metadata

Point `adapter: dartdoc` at the directory generated by `dart doc` to import native HTML signatures and member descriptions. The legacy JSON-array input with `name`, `qualifiedName`, numeric `kind`, and `desc` is also accepted; that compact index only reads kinds `3` (class), `5` (enum), and `8` (extension) and does not contain complete method details.

The native TypeDoc reader now walks nested modules and members, preserving signatures, parameter types, returns, examples, properties, enum values, and overload declarations. Complex upstream features and custom themes are not a guarantee of complete semantic parity. The exact tested versions and known boundaries are in **Explore SDK samples**.

## Bound native input sizes

Every SDK entry accepts `maxFiles` (default 10,000), `maxFileBytes` (default 10 MiB), and `maxTotalBytes` (default 100 MiB). Directory walks and file sizes are bounded. Symlinks and XML entities/DOCTYPE declarations are rejected. The loader does not execute artifact scripts, Python pickle files, or Ruby Marshal databases.

F# DocFX import uses actual compiled F# APIs. If the artifact supplies only C# syntax, its declaration is labeled C#. Scala support here targets Scaladoc 2 HTML; Rust support targets stable rustdoc HTML. HTML adapter selectors depend on the generator format, so custom themes and new incompatible versions may require an adapter update.

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

