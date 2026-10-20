# Contributing to Docsy

Thanks for helping improve Docsy.

## Development

Use Node 22.22+; CI also installs Bun 1.3.5 for cross-runtime checks. Without Bun locally, the Bun-only MDX unit check is explicitly skipped; use `npm run test:runtime:bun` when Bun is installed.

```bash
npm ci
npm run dev
```

The included `docsy.config.yaml` uses a committed public OpenAPI example. Open the address printed by the development server, under the configured `site.basePath` (currently `/docsy/`).

## Before a pull request

```bash
npm test
npm run validate
npm run build
```

Keep changes inside these boundaries:

- YAML owns product configuration, navigation, ingestion, theme tokens, and access rules.
- Astro and CSS own interface behavior and presentation.
- Adapters normalize external documentation formats before rendering.
- Protected documentation must be enforced on the server and must not be copied into `public/`.

Do not introduce an external font service or typographic tracking.

## Pull requests

Describe the behavior being changed, include screenshots for visible changes, and mention whether you tested both open and locked access modes.

Every PR targeting `main` runs Node tests and the portal build, real native-generator import checks, Bun production-runtime tests, and the clean installed-tarball end-to-end test. The combined **PR checks** job reports success only when all four pass. Open/static builds attach a seven-day, downloadable `docsy-static-preview-…` artifact containing the mount-aware site; it is not publicly hosted. Protected/server output is not uploaded as a static preview.

PR validation uses read-only permissions and no secrets, with no automatic approval, merge or deployment. Automatic Pages deployment is chained after passing main-branch checks and gated by `DOCSY_ENABLE_PAGES`; it is enabled for this repository's public documentation portal. npm publication uses the separate, manually dispatched [release workflow](.github/workflows/release-npm.yml), disabled unless its owner-controlled gate is enabled and the exact package/version is confirmed. Required merge-check enforcement depends on the repository's branch rules.

Fork-originated workflows follow the repository and organization's Actions approval policies. Treat fork code as untrusted, require maintainer approval where configured, and do not grant fork jobs secrets or write tokens. Approving a run authorizes CI, not a merge or release; this workflow does not change those repository settings itself.

## Contribution terms

Docsy is source-available under the [Elastic License 2.0](LICENSE). By submitting a contribution, you confirm that you have the right to submit it and agree that it will be distributed under ELv2 with the rest of Docsy. Your submission must not include code under terms that conflict with ELv2.
