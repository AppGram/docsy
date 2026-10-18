import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const deploymentGuide = ({ deployment = 'none', repo = '', basePath = '/docs' } = {}) => {
  const parts = repo ? new URL(repo).pathname.split('/').filter(Boolean) : [];
  const destination = parts.length ? `https://${parts[0]}.github.io${basePath === '/' ? '/' : `${basePath}/`}` : '';
  return `# Bring your content, preview it, then choose a host

No repository was created, pushed, or deployed by the generator. Keep deployment off during private development.

## 1. Make the project yours

Edit \`content/getting-started.md\`, register more articles under \`content.articles\` in \`docsy.config.yaml\`, and configure your OpenAPI/SDK sources there. Product name, navigation, colors, reader links and access tiers are YAML settings. The Astro source remains editable under \`src/\`.

## 2. Check the actual build

Use Node 22.22+ for installation/builds:

\`\`\`bash
npm install
npm run docsy -- doctor
npm run build
npm run preview
\`\`\`

Open \`http://localhost:8080${basePath === '/' ? '/' : `${basePath}/`}\`. This is only a local preview, not a public URL. Check navigation, both themes, source links, and your actual examples. Runtime permissions require testing with your real trusted identity integration.

${deployment === 'github-pages' ? `## 3. Store the project in your chosen repository

Target: ${repo}

If this is a new local Git checkout, review the files before committing. Never commit environment files, credentials or sensitive documentation into a repository that may later become public. Then, only when you intend to push this source to that repository:

\`\`\`bash
git init -b main
git add .
git commit -m "Set up documentation"
git remote add origin ${repo}
git push -u origin main
\`\`\`

For an existing checkout/remote, use its normal branch and review flow instead. The generated workflows target \`main\`; adjust that name if needed. Commit the generated lockfile so builds can be reproduced. Keep \`.docsy/template.json\` in Git for future upgrade comparisons.

## 4. Explicit publishing decision — do not enable during the private hold

The expected future site is **${destination}**. It is not live merely because this file lists it.

When the owner explicitly approves publication: in GitHub repository settings, select **Pages → GitHub Actions** as the source. Check the \`github-pages\` environment's protection settings, then set the Actions repository variable **DOCSY_ENABLE_PAGES=true**. Run **Deploy documentation** from Actions (or push to \`main\`). Until the variable is set, deployment is skipped.

Wait for both build and deploy jobs to succeed. Use the URL on the deployment result, open an article directly, and reload it to verify base-path routing and assets. A failed job or configured URL is not a deployment. GitHub Pages availability depends on your account/repository settings; do not change visibility just to fix a failure.

The workflow uploads \`dist/\`, not \`release/\`. Keep \`access.mode: open\` and \`agent.query: false\`. A static host cannot enforce private tiers. A private source repository does not by itself guarantee a private Pages website.
` : `## 3. Choose an explicit host

No deployment workflow was selected. Open static output can be served from \`release/\` using the included server or your own static host. Preserve the configured base path. The standalone runtime uses \`npm start\`, or \`npm run start:bun\` on Bun 1.3.5+ after the same Node build. Docker and Bun Dockerfiles are included.

Locked mode or \`agent.query: true\` needs the Node/Bun server, not static file hosting. Put trusted header authorization behind a proxy that strips visitor-supplied identity headers, or configure your application's authorization webhook. Configure TLS, domain/DNS, and your host's environment before exposing the site. The host's successful deployment result supplies your real URL; the generator does not invent one.
`}
## Updates and review

Read \`UPGRADING.md\` before importing future template changes. Optional \`--ci\` validation attaches a rendered preview only for open static builds; it never publishes that artifact as a website. Protected/server bundles are intentionally not attached as static previews.
`;
};

// Deliberately gated: selecting a template never grants permission to publish it.
export const writeWorkflows = (target, { ci = false, deployment = 'none' } = {}) => {
  const directory = resolve(target, '.github/workflows');
  mkdirSync(directory, { recursive: true });
  if (ci || deployment === 'github-pages') writeFileSync(resolve(directory, 'docsy-checks.yml'), `name: Check documentation
on: [push, pull_request, workflow_dispatch]
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - run: npm install --ignore-scripts
      - run: npm run build
      - name: Detect public static preview
        id: preview
        run: node --import tsx --input-type=module -e "import {isServer} from './src/config.ts'; import {appendFileSync} from 'node:fs'; appendFileSync(process.env.GITHUB_OUTPUT, 'static=' + !isServer + '\\n');"
      - uses: actions/upload-artifact@v7
        if: steps.preview.outputs.static == 'true'
        with:
          name: docsy-static-preview
          path: dist
          retention-days: 7
`);
  if (deployment === 'github-pages') writeFileSync(resolve(directory, 'pages.yml'), `name: Deploy documentation
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
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - run: npm install --ignore-scripts
      - name: Require static public configuration
        run: node --import tsx --input-type=module -e "import {isServer} from './src/config.ts'; if (isServer) throw new Error('Pages cannot host restricted content or live agent queries. Use Node/Bun.');"
      - uses: actions/configure-pages@v6
      - run: npm run build
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v5
        id: deployment
`);
};
