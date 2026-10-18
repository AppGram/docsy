Docsy converts Swagger 2 or OpenAPI 3 documents into normalized endpoint pages, navigation targets, search entries, request examples, response examples, and Markdown exports.

## Try the live portal sample

Open [Posts · requests](/api/posts) for GET, POST, PUT, PATCH, and DELETE examples, or [Comments · query parameters](/api/comments) for a filtered GET. Copy a curl command into your terminal to make the request. Docsy displays request examples; it does not execute them in the browser.

These pages use the public [JSONPlaceholder test API](https://jsonplaceholder.typicode.com/guide/). No signup or API key is needed. Writes are simulated, not persisted. Response blocks are illustrative schema examples; live GET text can differ.

The input is a **Docsy-authored OpenAPI subset**, not an official specification published by JSONPlaceholder. It is committed as `sources/samples/jsonplaceholder.openapi.yaml`, so builds do not depend on fetching a remote specification. The old Nager.Date snapshot remains in `sources/openapi.json` as an alternative source.

The portal enables the sample entirely through YAML:

```yaml
ingestion:
  openapi:
    enabled: true
    source: sources/samples/jsonplaceholder.openapi.yaml
    apiBaseUrl: https://jsonplaceholder.typicode.com
    sections:
      - section: posts
        title: Posts · OpenAPI sample
        description: Public requests; writes are simulated, not persisted.
        tags: [posts]
      - section: comments
        title: Comments · OpenAPI sample
        description: Filter comments by postId.
        tags: [comments]
```

For example, the specification’s POST request contains:

```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/PostInput'
      example:
        title: Hello from Docsy
        body: This request example comes from OpenAPI, not hardcoded UI.
        userId: 1
```

Docsy turns that into the body fields and JSON curl payload on the Posts page. A parameter’s `example`, named `examples`, schema `example`, or schema `default` supplies the generated request value. Optional query and header parameters appear in curl when an example is available; required parameters without examples retain placeholders. Scalar parameter values are URL-encoded in paths and queries. Complex OpenAPI parameter serialization styles are not implemented.

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

## Choose request languages in YAML

The portal supports 24 language/client targets. These are **HTTP request snippets**, separate from importing a library's native documentation.

```yaml
ingestion:
  openapi:
    enabled: true
    source: sources/openapi.yaml
    apiBaseUrl: https://api.example.com
    examples:
      languages: [curl, typescript, python, go, swift, kotlin, dart, csharp]
      defaults: required
      customSamples: true
```

`languages` controls the visible choices and their order. The selector remembers the reader's language across endpoint cards and pages. A single language hides the selector. Unknown language keys, duplicate entries, and empty lists fail YAML validation.

Supported keys are `curl`, `javascript`, `typescript`, `node`, `python`, `go`, `java`, `kotlin`, `csharp`, `c`, `cpp`, `rust`, `swift`, `objectivec`, `dart`, `php`, `ruby`, `scala`, `elixir`, `lua`, `fsharp`, `visualbasic`, `powershell`, and `r`. JavaScript and TypeScript use fetch; Node is a separate runtime target, and C/C++ share a libcurl request backend. These are not 24 distinct programming languages.

`defaults: required` includes required parameters plus optional parameters with explicit examples/default values. `defaults: all` also includes placeholders for other optional query/header parameters. Credentials always use placeholders. Do not put live secrets in specifications or samples.

Generated samples share one normalized method, URL, headers, and body. Their client libraries must be installed by the reader: examples include Python requests, Kotlin OkHttp, Dart http, Rust reqwest, R httr, and Lua-cURL. Other targets use their standard HTTP APIs or the library shown in the selector. Some snippets are intended to be placed inside a program rather than executed as standalone files.

All configured request samples are also exported to Markdown and agent JSON. Search indexes their text. They are displayed and copied, never executed by Docsy.

## Supply actual SDK calls

HTTP snippets do not magically know your SDK's method names. Put real SDK examples on an operation using `x-codeSamples`:

```yaml
paths:
  /posts:
    post:
      # Keep the operation's requestBody, responses, etc.
      x-codeSamples:
        - lang: python
          label: Your Python SDK
          source: |
            client.posts.create(title="Hello from Docsy", user_id=1)
```

With `customSamples: true` (the default), matching custom samples replace the generated example for that configured language. Other languages remain generated. With `customSamples: false`, Docsy ignores these overrides. Multiple custom examples can share a language with distinct labels. The example above illustrates the extension shape; replace it with calls from your actual SDK.

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
