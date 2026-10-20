# Changes

## 0.4.2

- Subtle article-footer edit links by default, with independent YAML placement (`header`/`footer`) and style (`subtle`/`button`) options.
- YAML-registered draw.io SVG/PNG previews with optional editable-source downloads in Markdown and MDX, using the existing fullscreen viewer and article access gates.

## 0.4.1

- Remove the internal npm release runbook from source and distributed packages, with an archive-audit regression check.
- Simplify the README introduction and update versioned CLI examples to this patch release.
- Publish through the protected GitHub Actions trusted-publisher workflow with npm provenance.

## 0.4.0

- Public npm package metadata and a versioned, audited tarball packer.
- A manual GitHub Actions release workflow: verify-only by default, separately gated OIDC publishing of the exact tested archive.
- Clean installed-package tests covering generation, user-supplied OpenAPI/MDX, validation, static serving, locked serving and permission-aware agent exports.
- YAML authors, profile pictures and theme-aware unknown-author placeholders, reviews, dates, optional agent provenance and per-page edit controls.
- Public documentation portal, YouTube product tour, and npm CLI distribution.

## 0.4.0-internal.0 — internal, not published

- Prepare versioned local CLI packages; public npm publication remains blocked.
- Optional validation/preview and explicitly gated GitHub Pages workflow scaffolding.
- Local environment/deployment diagnostics and source-template provenance.
- Non-destructive template upgrade comparison with conflict reporting.
- Bounded local Mintlify migration with navigation, assets, notices and redirects; unsupported MDX fails explicitly.
- YAML-configurable article edit/report links with version and locale context.
- Trusted executable example assertions and private rendered CI preview artifacts; protected/server bundles are excluded.
- Real Zod, YAML and Lodash generator/import/render stress tests, with provenance and honest coverage/performance limits.
- Actual Zod error-API migration through the coding agent, a reviewed executable example assertion, and an independently built local review bundle. No remote PR was opened.
- Tested Bun production runtime option; Node remains the build toolchain.
- Position as Docsy by AppGram, leading with source ownership and self-hosting.
- Adoption work continues in this prerelease; no public release or deployment is authorized.

## 0.3.0 — unreleased development baseline

Rich articles, full-text search, versions/localization, agent exports and maintenance, native generator imports and syntax-highlighted examples. This entry records the previous development version, not a public release.
