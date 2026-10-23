# Changes

## 0.4.4

- YAML-configurable, theme-aware 404 pages with centered/sidebar layouts, optional illustration, search and recovery links, plus locale copy overrides.
- Missing runtime article/API/SDK routes now return a real 404 instead of redirecting to the overview. Static previews serve the branded error document with status 404.
- Keep 404 recovery links usable when translations are unavailable, document static-host error routing, and exclude generated bundles from source validation.

## 0.4.3

- Render Mermaid fences in Markdown/MDX, including UML class, sequence and state diagrams, with local assets, existing fonts, theme switching, copyable source and fullscreen zoom/pan.
- Add YAML-configurable Mermaid enablement and resource limits; reject diagram-local configuration and external resources/fonts.
- Support protected PlantUML SVG/PNG exports with optional `.puml`/`.plantuml` downloads. Raw PlantUML is not executed or sent to a remote service.
- Add a diagram tutorial and real PlantUML-generated example, with article, permission-filtering and package-install regression coverage.

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
