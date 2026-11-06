AppGram can host an open-mode Docsy site for you. It is served under `/developers` on your project's AppGram portal, for example `https://acme.appgram.page/developers/`, and on the project's verified custom domain. Hosting is included on every AppGram plan, one docs site per project. Self-hosting stays free and works exactly as before.

:::note[Open mode only]
Hosted docs are static. A site with `access.mode: locked` or `agent.query: true` needs a Node server, so `docsy deploy` refuses it before uploading anything. Deploy in open mode, or [self-host](/guides/deployment/self-hosting) locked mode. To keep hosted docs private, set the site to organization-only in the dashboard: readers then sign in with their AppGram account.
:::

## What you need

- The AppGram **project ID** (Project settings in the dashboard).
- An AppGram **API key** with the `help_center:manage` scope, in the `APPGRAM_API_KEY` environment variable.
- Node 22 or newer. The command uses only Node built-ins; nothing extra is installed.

## Deploy from your machine

```bash
export APPGRAM_API_KEY=ag_...
npm run deploy -- --project <projectId>
```

`npm run deploy` is the same as `npm run docsy -- deploy`. It:

1. Reads `docsy.config.yaml` (or the file named by `DOCSY_CONFIG`) and stops if the site is locked.
2. Builds the site with `site.basePath` forced to `/developers` and `site.origin` set to your portal address when the site already exists. Your config file is not changed; a temporary copy is written to `.docsy/deploy/`.
3. Hashes every file in `release/developers/` with SHA-256.
4. Sends the file list to AppGram, uploads only the files AppGram does not already have (eight at a time, retried on network and server errors), and finalizes the deploy.
5. Prints the live URL.

Because files are content-addressed, a redeploy that changes one page uploads one page plus whatever the build re-hashed.

| Option | Meaning |
| --- | --- |
| `--project <id>` | AppGram project to deploy to (required) |
| `--message <text>` | Note shown next to the deploy in the dashboard |
| `--no-build` | Deploy the existing `release/developers/` build; it must have been built with `site.basePath: /developers` |
| `--no-activate` | Upload and finalize without making it live; activate it later from the dashboard |

| Variable | Meaning |
| --- | --- |
| `APPGRAM_API_KEY` | API key with `help_center:manage` (required) |
| `APPGRAM_API_URL` | API base URL; defaults to `https://api.appgram.dev` |

Limits per deploy: 5,000 files, 200 MB in total and 25 MB per file. AppGram keeps your last 20 deploys, so you can roll back from the dashboard.

## Deploy from GitHub Actions

Add the API key as a repository secret named `APPGRAM_API_KEY`, then create `.github/workflows/appgram-docs.yml`:

```yaml
name: Deploy docs to AppGram

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: appgram-docs
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      # The message goes through env, never pasted into the script: commit
      # messages and PR titles are attacker-controlled text.
      - run: npm run deploy -- --project "$APPGRAM_PROJECT_ID" --message "$MESSAGE"
        env:
          APPGRAM_API_KEY: ${{ secrets.APPGRAM_API_KEY }}
          APPGRAM_PROJECT_ID: ${{ vars.APPGRAM_PROJECT_ID }}
          MESSAGE: ${{ github.event.head_commit.message }}
```

Set `APPGRAM_PROJECT_ID` as a repository variable, or write the ID inline. Deploys from Actions record the commit SHA and show as coming from GitHub.

## Sites generated before 0.4.7

Older projects do not have `scripts/deploy.mjs` or the `deploy` script. Generate a fresh project with the current version, compare with `npm run docsy -- upgrade --from <fresh-project>`, and copy `scripts/deploy.mjs` and `scripts/docsy.mjs` across. Add `"deploy": "node scripts/docsy.mjs deploy"` to `package.json` and `.docsy/deploy/` to `.gitignore`.
