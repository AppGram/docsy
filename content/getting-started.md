Docsy generates a polished documentation portal without putting your content or interface behind a hosted control plane. You keep the YAML, Markdown, ingestion sources, Astro components, and deployment configuration in your own repository.

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

Use the included generator when you want a separate documentation site:

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

Open mode produces a static Astro build. Locked mode produces a standalone Node server so authorization can run for every request.

## Choose the next guide

- Configure the portal through `docsy.config.yaml` in **YAML configuration**.
- Add first-class Markdown pages in **Authored articles**.
- Generate reference pages in **OpenAPI ingestion** and **SDK adapters**.
- Publish the static portal in **GitHub Pages** or run it yourself using **Self-hosting**.

