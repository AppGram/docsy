# Operations and retrieval

## Create a project

First determine whether the user has a Docsy template checkout, a generated site, or a supplied package. Check local help/version rather than assuming a public npm CLI exists. This skill was authored against the private `0.4.0-internal.0` implementation; a newer release may change availability or flags.

From the template checkout:

```bash
npm run create -- ../my-docs --yes --no-install --name "My API" --base /docs --ci
```

From a generated project use `npm run docsy -- create ...`. A private template with `release:pack` can generate a local tarball and print an `npm exec --package "/absolute/path/to/package.tgz" -- create-docsy ...` command. Use the actual returned path/version. Do not substitute `npx ...@latest` for an unpublished package or use `--force` on an existing project without explicit overwrite intent.

`--open` means static/open access, not permission to publish. `--locked` selects request-time authorization. `--ci` adds validation/preview scaffolding; `--deploy github-pages --repo https://github.com/OWNER/REPO` adds an explicitly gated deployment workflow. Creation does not create a remote repo, push or deploy. Install dependencies in the new project and run doctor/validation/build before reporting it ready.

## Migrate from Mintlify

```bash
npm run docsy -- migrate mintlify \
  --source ../mintlify-export \
  --out ../new-docsy-project \
  --base /docs --ci
```

Use a local source export with `docs.json` or `mint.json`; destination must be new and outside the source. Native `.mdx` stays MDX by default. `--format markdown` deliberately selects the older, limited conversion. Inspect `migration/report.json`, rewritten links, navigation, assets and redirects; preserve upstream notices. The importer does not execute source JavaScript, enable trusted MDX or copy arbitrary modules/fonts/credentials. Unknown/executable components, missing linked pages, symlinks and unsupported dynamic/multi-version navigation fail rather than silently dropping content. Export one version/locale first. Map API configuration and custom integrations explicitly.

## Select hosting from actual runtime requirements

Use Node 22.22+ for the supported build toolchain. The tested standalone runtime also supports Bun 1.3.5+; respect the installed package's current engine requirements.

```bash
npm run validate
npm run build
HOST=127.0.0.1 PORT=8080 npm run preview
```

- Open access plus `agent.query: false`: static `dist/` and mount-aware `release/`. Serve the `release/` root for a local production preview that preserves the base path.
- Locked access **or** `agent.query: true`: standalone `dist/server/entry.mjs`; use `npm start` or `npm run start:bun`, or included Node/Bun Dockerfiles. Do not serve its output as a static site.
- GitHub Pages is static-only. Its workflow uploads `dist/`, not the mount-aware `release/`. Check base/origin and direct article reloads.
- Configure TLS/proxy/environment on the selected host when deployment is actually requested. A future configured origin is not proof that a site is live.

Keep any existing release hold and repository privacy intact. Generated Pages workflows remain gated by `DOCSY_ENABLE_PAGES`; do not enable it merely to test a build. Private repositories do not necessarily imply private hosted sites. PR preview artifacts are downloadable build outputs, not public deployment URLs; never upload a locked/server bundle as a static preview.

## Lock mode

```yaml
access:
  mode: locked
  provider:
    type: header
    tierHeader: x-docsy-tiers
    userHeader: x-docsy-user
  tiers:
    enterprise:
      label: Enterprise
  rules:
    - pattern: /guides/internal/**
      tiers: [enterprise]
    - pattern: /api/admin
      tiers: [enterprise]
```

Rules are ordered; the first match wins. `*` matches one segment and `**` spans segments. **Unmatched routes remain public**, even in locked mode; explicitly protect every intended section. Canonical rules apply across version/locale variants. Configure login/gate copy separately; Docsy authorizes content, while the application/proxy authenticates users.

Header mode is safe only behind a trusted proxy that authenticates users, strips visitor-supplied identity headers, sets trusted headers and prevents direct server bypass. Alternatively, use a webhook provider forwarding only needed cookie/authorization headers to the application's authorization endpoint. Webhook errors/timeouts fail closed for protected routes. Never treat a client-provided tier as an identity integration.

Validate both denied and allowed behavior for page HTML, JSON documents, Markdown exports, search, `/llms.txt`, `/llms-full.txt` and the corpus. Rebuild after policy or source changes. Keep protected source artifacts out of `public/`.

## Read documentation as a coding agent

For retrieval-only requests, use the existing docs endpoint rather than modifying the site. Prefix these resources with its configured base path:

| Resource | Use |
| --- | --- |
| `/llms.txt` | Discovery links |
| `/llms-full.txt` | Combined readable docs |
| `/agent/index.json` | Context-aware full-text corpus and retrieval URLs |
| `/agent/pages/guides/authentication.json` | One page's metadata and rendered Markdown |
| `/format-md/guides/authentication` | Clean Markdown export |

The overview key is `index`. Variant keys include `versions/<version>/<locale>/...`. Prefer record-supplied `jsonUrl`, `markdownUrl` and canonical citation URLs; inspect `contentLocale` and `isFallback`. Imported MDX exports component content, not JSX/import code. Follow existing authentication; do not assume the JSON surface bypasses gates.

`agent.query: true` enables runtime `GET /agent/query.json?q=...&version=...&locale=...&type=page&limit=5`, with `type` optionally `page`, `api` or `sdk`. This returns ranked excerpts and retrieval links, not an LLM answer. It needs no AI provider key. Static sites cannot execute query parameters; retrieve the index and search locally instead. Do not enable a server feature just to answer a documentation question.

## Maintenance and upgrades

`npm run maintain -- plan --base <ref>` compares committed revisions and writes impact/prompt artifacts without calling a model. `run` invokes the configured agent, requires enabled maintenance, a clean checkout and authentication; it validates a local update. `--pr` additionally commits, pushes and opens a draft: use only with explicit PR authority. `verify` applies and checks a proposed patch in a clean checkout.

The maintenance guard currently permits matching Markdown paths and selected YAML fields; it does not automatically edit `.mdx`, arbitrary scripts, execution settings or access policy. Preserve that boundary. Explicit `maintenance.exampleChecks` run trusted commands; their success applies only to those checks, not all imported examples. Do not add or change commands to bypass failures without the user's requested scope. Review breaking-change explanations and stale examples before merging.

For template updates, generate a fresh project from the selected newer version, then use `npm run docsy -- upgrade --from <fresh-project>`. This writes a comparison/conflict report; it is not an automatic updater. Preserve `.docsy/template.json`, local configuration, content, dependency changes and UI customizations. Reconcile deliberately, then validate/build and inspect the result.

Use `reader.editUrl`/`reportUrl` for optional correction links, with `{source}`, `{version}` and `{locale}` placeholders in edit URLs. They are navigation affordances, not authority to submit issues or edits. Preserve existing license/copyright notices when distributing software; visible footer branding can be changed independently.
