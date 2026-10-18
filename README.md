<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/docsy-logo-dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="docs/assets/docsy-logo.png" />
    <img src="docs/assets/docsy-logo.png" alt="Docsy logo" width="200" />
  </picture>
</p>

<h1 align="center">Docsy</h1>

<p align="center"><strong>Documentation built for humans and coding agents.</strong></p>

<p align="center"><a href="https://appgram.github.io/docsy/">Documentation</a> · <a href="https://github.com/AppGram/docsy/issues">Issues</a></p>

Docsy turns Markdown, OpenAPI, and SDK metadata into a self-hosted documentation portal. Readers get searchable guides and reference pages in a polished interface. Coding agents get Markdown exports to read, structured configuration to edit, and a local validation and build workflow to check their changes.

Product copy, navigation, visual tokens, ingestion, and access rules live in `docsy.config.yaml`. The generated Astro components and CSS stay in your repository, alongside `AGENTS.md` and `DOCSY_BRIEF.md` to guide your coding agent.

Docsy can ship as a fully static site or as a server-rendered Node application with permission-gated documentation tiers.

> This project is independent of the Hugo theme with a similar name.

## For humans and coding agents

For readers, Docsy brings authored guides, API endpoints, and SDK reference together with navigation, search, code examples, and light/dark themes.

For coding agents, the same documentation is available as Markdown. An agent working in the generated repository can update articles, configure ingestion and branding in YAML, or edit the Astro interface. The CLI includes project instructions and a customization brief, and `npm run validate` plus `npm run build` check the result before review.

Give your coding agent a concrete task:

```text
Read AGENTS.md, DOCSY_BRIEF.md, and docsy.config.yaml.
Use sources/openapi.json to write a first-request guide in content/.
Register it in YAML and add it to the sidebar.
Use the API source for endpoint names, parameters, and examples.
Preserve the existing UI and access rules.
Run npm run validate and npm run build, then summarize the diff.
```

Use `/format-md/...` exports when an agent needs to fetch documentation over HTTP. The Markdown menu exposes the current page's export; `?format=md` opens its Markdown view in the browser. Your chosen coding agent works with the repository, and you review and publish its changes through your normal Git workflow.

See [Work with coding agents](content/tutorials/coding-agents.md) for both reading and authoring workflows.

## Preview

These screenshots show the default interface configured for the public Nager.Date OpenAPI—not AppGram product documentation.

### Light and dark

<table>
  <tr>
    <th width="50%">Light</th>
    <th width="50%">Dark</th>
  </tr>
  <tr>
    <td><img src="docs/assets/docsy-light.png" alt="Docsy OpenAPI reference using the light theme" /></td>
    <td><img src="docs/assets/docsy-dark.png" alt="Docsy OpenAPI reference using the dark theme" /></td>
  </tr>
</table>

Both are the same generated OpenAPI page. Switching `theme.mode` and the YAML color tokens changes the presentation without replacing the interface.

### Permission gate

![A Docsy API page protected by a configured documentation tier](docs/assets/docsy-lock-mode.png)

## What Docsy gives you

- An editable Astro project with `AGENTS.md` and `DOCSY_BRIEF.md` for coding agents.
- OpenAPI 3 and Swagger 2 ingestion from local JSON/YAML or an HTTPS URL.
- SDK adapters for TypeDoc, TypeDoc-lite, Swift symbol JSON, and Dartdoc.
- Generated API pages, navigation, search data, curl examples, response examples, and Markdown exports.
- First-class authored Markdown articles for guides, tutorials, concepts, and migration notes.
- One YAML file for branding, content, navigation, routes, ingestion, theme tokens, and access rules.
- A persisted light/dark theme toggle with independently configurable palettes.
- Open mode for static hosting and lock mode for server-side permission checks.
- Header-based identity for trusted auth proxies or webhook authorization for an existing application.
- Docker and Docker Compose files for a short self-hosting path.
- System font stacks by default: no hosted font service and no generated typographic tracking.

## The mental model

```text
Markdown / OpenAPI / SDK metadata
        │
        ▼
 content loaders/adapters ──► normalized docs model
        │
        ▼
 docsy.config.yaml ───► routes, navigation, theme, access rules
        │
        ▼
 editable Astro source
        │
        ├── open mode   ──► static files in release/
        └── locked mode ──► Node server with request-time authorization
```

The important boundary is simple:

- YAML owns durable configuration and content wiring.
- Astro and CSS own the interface.
- The article loader and ingestion adapters own source-format differences.
- Lock mode owns request-time authorization, not user authentication itself.

Docsy never requires a hosted control plane. A generated project builds and runs from its own repository.

## Documentation

The repository is its own Docsy documentation portal. Every article is readable on GitHub and rendered at [appgram.github.io/docsy](https://appgram.github.io/docsy/) through `content.articles`:

| Article | What it explains |
| --- | --- |
| [Get started with Docsy](content/getting-started.md) | Run the portal, generate a project, and understand the ownership boundary |
| [Work with coding agents](content/tutorials/coding-agents.md) | Read Markdown exports, give an agent a project brief, and validate documentation changes |
| [Configure Docsy with YAML](content/tutorials/yaml-configuration.md) | The configuration lifecycle, top-level sections, paths, and environment values |
| [Write authored documentation](content/tutorials/authored-articles.md) | Markdown articles, YAML registration, navigation, search, exports, and permissions |
| [Ingest an OpenAPI document](content/tutorials/openapi-ingestion.md) | Local and remote sources, section matching, and navigation |
| [Ingest SDK documentation](content/ingestion/sdk-adapters.md) | TypeDoc, compact TypeDoc, Swift symbol, and Dart adapters |
| [Customize the default UI](content/customization/default-ui.md) | YAML brand tokens and the source-owned Astro interface |
| [Protect documentation by tier](content/tutorials/lock-mode.md) | Ordered access rules, trusted headers, webhooks, and locked deployment |
| [Deploy to GitHub Pages](content/deployment/github-pages.md) | Static Pages configuration and the included Actions workflow |
| [Self-host Docsy](content/deployment/self-hosting.md) | Static, Node, and Docker deployment shapes |
| [Understand the Docsy license](content/reference/license.md) | What ELv2 permits, what it prohibits, and how it applies to generated sites |
| [CLI reference](content/reference/cli.md) | Project generation, validation, building, and production startup |

## Quick start

Run Docsy's own documentation portal:

```bash
git clone https://github.com/AppGram/docsy.git docsy
cd docsy
npm ci
npm run dev
```

Open [http://localhost:4321/docsy/](http://localhost:4321/docsy/).

The portal uses the default light interface and renders every registered Markdown article. OpenAPI ingestion is disabled for the portal itself; the committed Nager.Date snapshot remains available as a deterministic example source.

## Generate a project

From a clone of this repository:

```bash
npm run create -- ../holiday-docs \
  --yes \
  --name "Holiday API" \
  --openapi ./sources/openapi.json \
  --api-base https://date.nager.at \
  --base /docs

cd ../holiday-docs
npm run dev
```

Use an OpenAPI URL instead of a local file when desired:

```bash
npm run create -- ../my-docs \
  --yes \
  --name "Acme API" \
  --openapi https://api.example.com/openapi.json \
  --api-base https://api.example.com \
  --base /docs \
  --locked
```

Without `--yes`, the CLI asks for the project directory, OpenAPI source, product name, mount path, and access mode. It then:

1. Parses the OpenAPI document.
2. Groups operations into sections using tags and path segments.
3. Copies the editable Astro interface.
4. Writes a validated `docsy.config.yaml`.
5. Copies local ingestion sources into `sources/`.
6. Adds `AGENTS.md` and `DOCSY_BRIEF.md` for safe AI-assisted customization.
7. Installs dependencies unless `--no-install` is supplied.

Run `node scripts/create-docsy.mjs --help` for every option.

## Configure it with YAML

`docsy.config.yaml` is the source of truth for the generated site:

```yaml
site:
  name: Acme API
  title: Acme API Documentation
  origin: ${DOCSY_ORIGIN:-http://localhost:4321}
  basePath: /docs
  logo: assets/docsy-mark.svg

theme:
  mode: dark
  colors:
    ink: "#f5f5f5"
    muted: "#a3a3a3"
    line: "#262626"
    paper: "#000000"
    accent: "#ffffff"
  fonts:
    display: '"Aptos Display", "SF Pro Display", "Helvetica Neue", sans-serif'
    body: '"Aptos", "SF Pro Text", "Helvetica Neue", sans-serif'
    mono: 'ui-monospace, "SF Mono", Menlo, monospace'

content:
  articles:
    - slug: getting-started
      source: content/getting-started.md
      title: Getting started
      description: Make your first authenticated request.
      eyebrow: GUIDE

navigation:
  - title: API Reference
    items:
      - title: Users
        href: /api/users

ingestion:
  sdks: []
  openapi:
    enabled: true
    source: sources/openapi.yaml
    apiBaseUrl: https://api.example.com
    sections:
      - section: users
        title: Users
        description: Create and manage users.
        tags: [users]
        paths: [/users]
```

`${ENV_NAME}` and `${ENV_NAME:-fallback}` placeholders are expanded before validation. Set `DOCSY_CONFIG` to use a different YAML file without changing source.

Configuration errors fail with their exact YAML path. Run this before committing:

```bash
npm run validate
```

## Authored Markdown articles

Docsy can render documentation you write directly; OpenAPI and SDK ingestion are optional companions, not the only content model.

Create a Markdown file outside `public/`:

```text
content/guides/authentication.md
```

Register it in YAML:

```yaml
content:
  articles:
    - slug: authentication
      source: content/guides/authentication.md
      title: Authentication
      description: Create a token and authenticate API requests.
      eyebrow: GUIDE

navigation:
  - title: Guides
    items:
      - title: Authentication
        href: /guides/authentication
```

Docsy serves it at `/guides/authentication` underneath `site.basePath`. Nested slugs such as `platform/security/authentication` create nested guide URLs. Level-two and level-three headings populate the page rail.

Authored articles automatically participate in navigation, search, Markdown export, and lock-mode permission rules. Keep protected Markdown outside `public/`, because files under `public/` are served as unprotected static assets.

## OpenAPI ingestion

`ingestion.openapi.source` accepts:

- A project-relative `.json`, `.yaml`, or `.yml` file.
- An `http://` or `https://` URL fetched during the build.

The adapter handles Swagger 2 and OpenAPI 3 parameters, request bodies, response content, component schemas, examples, and security declarations. Each configured section matches operations by tag substring, path substring, or both.

For deterministic, private, or air-gapped builds, commit a spec snapshot under `sources/`. Do not place a protected specification under `public/`; files there bypass lock-mode middleware.

## SDK ingestion adapters

Every adapter normalizes its input into the same internal `SDKDoc` model. Rendering, search, and Markdown export therefore do not need to know which documentation generator produced the source.

| Adapter | Input shape | Typical source |
| --- | --- | --- |
| `typedoc-lite` | `modules[0].types` plus `navigation.categories` | React or React Native metadata |
| `swift-symbols` | Types, protocols, enums, and navigation categories | Swift symbol or docc2json output |
| `dartdoc` | Flat Dartdoc symbol array | Flutter package documentation |
| `typedoc` | TypeDoc project with top-level `children` | Browser or Node SDKs |

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

Source paths are resolved from the project root.

## Permission-gated lock mode

Open mode is the static default:

```yaml
access:
  mode: open
```

Locked mode switches the Astro build to Node SSR and evaluates ordered access rules on every protected request:

```yaml
access:
  mode: locked
  provider:
    type: header
    tierHeader: x-docsy-tiers
    userHeader: x-docsy-user
  tiers:
    developer:
      label: Developer
    enterprise:
      label: Enterprise
      description: Restricted platform operations.
  rules:
    - pattern: /api/license-keys
      tiers: [enterprise]
    - pattern: /api/**
      tiers: [developer, enterprise]
  gate:
    title: This API reference is locked.
    description: Sign in with an account that can access this reference.
    loginUrl: https://app.example.com/login
    loginLabel: Sign in to continue
```

Rules are evaluated from top to bottom. `*` matches one path segment; `**` matches any number of segments. The same rules protect rendered pages and Markdown exports, and search results are filtered to the visitor's tiers.

### Trusted-header provider

Use this behind Cloudflare Access, oauth2-proxy, an ingress gateway, or your own authentication proxy. The proxy must:

1. Remove client-supplied copies of the identity headers.
2. Authenticate the visitor.
3. Set the trusted tier and optional user headers.
4. Prevent visitors from reaching Docsy around the proxy.

Tier values may be comma- or space-separated.

### Webhook provider

If authorization belongs in your application:

```yaml
access:
  mode: locked
  provider:
    type: webhook
    endpoint: https://app.example.com/internal/docsy/authorize
    method: POST
    forwardHeaders: [cookie, authorization]
    pathHeader: x-docsy-path
    timeoutMs: 3000
```

The endpoint returns:

```json
{
  "authenticated": true,
  "subject": "user_123",
  "tiers": ["developer"]
}
```

Timeouts, errors, and non-2xx responses fail closed.

## Customize the interface

Start with YAML for branding and stable tokens. Edit source when the request is truly about layout or behavior:

| Concern | File |
| --- | --- |
| Product, routes, colors, fonts, access | `docsy.config.yaml` |
| Shell, header, search, mobile navigation | `src/layouts/DocsLayout.astro` |
| API and SDK presentation | `src/components/docs/` |
| Base design primitives | `src/styles/docsy.css` |
| YAML validation and path helpers | `src/config.ts` |
| OpenAPI normalization | `src/lib/swagger-loader.ts` |
| SDK normalization | `src/lib/sdk-loaders.ts` |

Generated projects include a customization brief for coding agents. Its rule is deliberate: preserve the working reference interface by default, use YAML for configuration, and touch Astro/CSS only for an explicitly requested UI change.

## Self-hosting

### Docker Compose

This is the shortest path for both access modes:

```bash
docker compose up --build
```

Open [http://localhost:8080/docs/](http://localhost:8080/docs/).

The container detects the build type automatically. Open mode serves staged static files; locked mode starts the Astro Node server.

### Static host

For `access.mode: open`:

```bash
npm ci
npm run build
```

Publish `release/` as the web root. The configured `site.basePath` is already staged underneath it, and `release/index.html` redirects to that mount path.

Any conventional static server, object storage website, or CDN can host this output.

### GitHub Pages

The repository includes `.github/workflows/pages.yml`. It validates and builds the open-mode portal, uploads `dist/`, and deploys it through the `github-pages` environment whenever `main` changes.

For a repository site, set `site.origin` to the GitHub Pages host and `site.basePath` to the repository name. The Docsy portal uses `https://appgram.github.io` and `/docsy`.

### Node server

For `access.mode: locked`:

```bash
npm ci
npm run build
HOST=0.0.0.0 PORT=8080 npm run preview
```

Put the process behind the trusted authentication proxy described above. Rebuild after changing `access.mode`, `site.basePath`, or ingestion configuration.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Astro development mode |
| `npm run validate` | Validate YAML and type-check Astro |
| `npm run build` | Validate, build, and stage production output |
| `npm run preview` | Serve the staged static build or locked Node build |
| `npm run create -- <dir>` | Generate a new editable project |

## Project structure

```text
.
├── docsy.config.yaml       # Product, theme, ingestion, navigation, access
├── content/                # Authored Markdown articles
├── sources/                # Private build-time OpenAPI and SDK inputs
├── public/                 # Public assets only
├── src/
│   ├── components/docs/    # API and SDK UI
│   ├── layouts/            # Documentation shell
│   ├── lib/                # Ingestion, access, Markdown export
│   ├── pages/              # Generated routes
│   └── styles/             # Source-owned styling
├── scripts/                # CLI, build staging, runtime launcher
├── Dockerfile
└── compose.yaml
```

## Contributing

Issues and pull requests are welcome. Before submitting a change:

```bash
npm ci
npm run validate
npm run build
```

Please preserve the configuration/source boundary, keep permission checks server-side, and avoid external font services or typographic tracking.

Contributions are distributed under ELv2. By submitting a pull request, you confirm that you have the right to contribute the code under those terms. See [CONTRIBUTING.md](CONTRIBUTING.md) for the complete project contribution guidance.

## License

Docsy is **source-available**, not OSI-approved open-source software. It is licensed under the [Elastic License 2.0](LICENSE) © AppGram.

### You may

- Self-host Docsy for your own public, private, personal, or commercial documentation.
- Configure and modify the YAML, Markdown, Astro components, styles, adapters, and runtime.
- Replace or remove visible Docsy and AppGram branding from your documentation pages, including the default footer and logo.
- Copy, redistribute, and publish modified versions when you include ELv2 and clearly state that you changed the software.
- Hire a consultant to configure or deploy Docsy for you.
- Keep your Markdown, OpenAPI files, SDK metadata, branding, and other documentation content under terms of your choosing.

### You may not

- Offer Docsy to third parties as a hosted or managed documentation service that exposes a substantial set of Docsy's features.
- Rebrand Docsy as your own competing SaaS documentation builder and charge customers to access it.
- Remove or hide the `LICENSE` terms or copyright notices from the Docsy software or copies you redistribute.
- Circumvent license-key functionality or protected features if Docsy adds them.

ELv2 does not require a visible "Powered by Docsy" or "Built by AppGram" notice on your published documentation. It does require the legal notices to remain with the software. ELv2 also does not require you to publish private modifications or prohibit commercial activity generally: consulting, integration, and using Docsy for a commercial product's own documentation remain allowed. The restriction is providing Docsy itself as a hosted or managed service. The [license text](LICENSE) controls if this summary and ELv2 differ.
