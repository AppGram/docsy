Docsy by AppGram is documentation you own: YAML configuration, native SDK and OpenAPI imports, editable source, and self-hosting. People read searchable guides and reference pages; coding agents read Markdown/JSON and help maintain the same repository.

:::note[Your source and hosting]
Docsy is source-available under ELv2. Use the versioned CLI, a local tarball or the public source repository. No hosted control plane is required. Generation and local preview do not deploy anything.
:::

## Run this documentation portal

Clone the repository and start the development server:

```bash
git clone https://github.com/AppGram/docsy.git
cd docsy
npm ci
npm run dev
```

Open `http://localhost:4321/docsy/`. Changes to `docsy.config.yaml`, Markdown articles, components, and styles are reflected locally.

## Generate a new project

Create your own site with the versioned npm CLI:

```bash
npm exec --package @appgram/docsy@0.4.2 -- create-docsy my-docs --yes --ci
cd my-docs
npm run dev
```

For local CLI development, run `npm run release:pack` in the source checkout and copy the tarball-based command it prints. Packing and testing never publish anything; registry publication has its own manual workflow and approval gates. Generated documentation projects remain `private: true` by default so they are not accidentally published as npm packages.

The source checkout also includes the generator directly:

```bash
npm run create -- ../acme-docs \
  --name "Acme API" \
  --base /docs
```

The CLI can start from authored Markdown alone. Add `--openapi` and `--api-base` when the project should also generate an API reference:

```bash
npm run create -- ../acme-docs \
  --name "Acme API" \
  --openapi https://api.example.com/openapi.json \
  --api-base https://api.example.com \
  --base /docs
```

The generated directory is an independent Astro project. It includes a starter guide, the default interface, validated YAML configuration, deployment files, and an AI customization brief.

Add `--ci` for validation and a downloadable static preview artifact. Add `--deploy github-pages --repo https://github.com/OWNER/REPOSITORY` for a gated Pages workflow and correctly derived origin/base path. Nothing goes live until you explicitly enable Pages and set the repository variable `DOCSY_ENABLE_PAGES=true`. Keep that switch off during private development. For runtime permissions or live queries, use Node/Bun self-hosting instead.

After creation, run `npm run docsy -- doctor`, add your content, then `npm run build` and `npm run preview`. The CLI prints the local path and, when selected, the expected future Pages URL. The **GitHub Pages** guide explains the final opt-in steps; generation itself never pushes or publishes.

Every generated project includes `DEPLOYING.md`: content setup, local preview, source storage, explicit publication, and verification of the actual live URL. Use it as the handoff checklist, keeping the publishing step disabled while the project is private.

Keep `.docsy/template.json` in Git. It records the template version and original file hashes so future fixes can be compared safely. See **Upgrade a customized site**; the comparison command does not overwrite your changes.

## Bring your coding agent

Open the generated repository with your coding agent and give it `AGENTS.md`, `DOCSY_BRIEF.md`, and `docsy.config.yaml` as context. Describe the content or behavior you want to change, then review the resulting diff and build.

For agents consuming published documentation, the portal's Markdown menu links to the current page's export. Direct `/format-md/...` URLs let HTTP clients fetch authored articles and generated API or SDK reference as Markdown.

The **Coding agents** guide walks through reading published docs, writing articles, and maintaining documentation after an API change.

## Understand the ownership boundary

Docsy has three deliberately separate layers:

| Layer | Owns |
| --- | --- |
| `docsy.config.yaml` | Product identity, article registration, navigation, visual tokens, ingestion, and access policy |
| `content/` and `sources/` | Markdown articles and build-time API or SDK metadata |
| `src/` | The editable Astro interface and CSS |

Use YAML for repeatable site configuration. Use Markdown for documentation prose. Edit Astro and CSS when the interface itself needs to change.

## Validate and build

Before deploying a project, run:

```bash
npm run validate
npm run build
```

Use Node 22.22 or newer to develop and build. Open mode with `agent.query: false` produces a static Astro build. Locked mode or `agent.query: true` produces a standalone server so authorization or live queries can run for every request. Start the build with Node using `npm start`, or use the tested Bun production runtime with `npm run start:bun` (Bun 1.3.5 or newer).

## Choose the next guide

- Configure the portal through `docsy.config.yaml` in **YAML configuration**.
- Read and maintain documentation with an agent in **Coding agents**.
- Add first-class Markdown pages in **Authored articles**.
- Generate reference pages in **OpenAPI ingestion** and **SDK adapters**.
- Publish the static portal in **GitHub Pages** or run it yourself using **Self-hosting**.

