GitHub Pages is a good fit for a public Docsy project running in open mode. Pages serves static files, so it cannot enforce lock-mode permissions.

:::warning[No public release yet]
This repository remains private and deployment stays disabled. The steps below describe a future explicit publishing decision. A configured URL is not an existing deployment.
:::

## Generate the workflow

Create a site with `--ci --deploy github-pages --repo https://github.com/OWNER/REPOSITORY`. The CLI writes validation and Pages workflows, derives the origin and repository base path, and prints the expected URL. It does not push, enable Pages, or publish anything. Run `npm run docsy -- doctor` inside the generated site to check the setup.

## Configure the public URL

For a project site at `https://ORGANIZATION.github.io/REPOSITORY/`, configure the host and repository path separately:

```yaml
site:
  origin: https://ORGANIZATION.github.io
  basePath: /REPOSITORY

access:
  mode: open
```

For this repository, those values are `https://appgram.github.io` and `/docsy`. The Astro build then emits links and asset URLs that work below the repository path.

## Add the deployment workflow

Create `.github/workflows/pages.yml`:

```yaml
name: Deploy documentation

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    if: vars.DOCSY_ENABLE_PAGES == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v7
      - name: Setup Node
        uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Configure Pages
        uses: actions/configure-pages@v6
      - name: Build
        run: npm run build
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v5
```

The deployed artifact must be `dist`, not `release/REPOSITORY`. GitHub Pages already mounts the artifact at the repository path, while Astro's `base` setting makes internal URLs point there.

## Enable the Pages source

Only when publication is explicitly intended: in repository settings, open **Pages** and choose **GitHub Actions** as the build source, then add the Actions repository variable `DOCSY_ENABLE_PAGES` with value `true`. Push to `main` or run the workflow manually. Leave the variable unset during private development; the build/deploy jobs are skipped.

The workflow requires `pages: write` and `id-token: write`, and deploys through the `github-pages` environment.

## Verify the production build locally

Run the same build before pushing:

```bash
npm ci
npm run validate
npm run build
```

Confirm that `dist/index.html` exists and that generated links begin with the configured base path. A `.nojekyll` file under `public/` is copied into the output so GitHub Pages serves Astro's generated assets unchanged.

## Do not publish protected sources

GitHub Pages sites are public even when the repository itself is private. Do not use Pages for protected documentation or publish sensitive Markdown, OpenAPI, or SDK inputs through the static artifact. Use locked mode on a Node or Bun server instead.

