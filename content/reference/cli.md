Docsy's CLI wraps Astro with configuration validation, project generation, build staging, and production startup.

## Project commands

The generated `package.json` exposes these scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Astro's development server |
| `npm run validate` | Validate YAML and type-check the site |
| `npm run build` | Validate, build, and stage production output |
| `npm run preview` | Serve the staged static site or standalone locked server |
| `npm run docsy -- doctor` | Check local prerequisites and deployment compatibility |
| `npm run docsy -- --version` | Show recorded template version |
| `npm run docsy -- upgrade --from <fresh-project>` | Write an upgrade comparison report; never apply changes |
| `npm run docsy -- migrate mintlify --source <export> --out <new-project>` | Import a supported local Mintlify export without changing its source |
| `npm run maintain -- plan --base <ref>` | Inspect source changes and likely documentation impact |
| `npm run maintain -- run --base <ref>` | Run the agent and validate a local documentation update |

Arguments after the command are passed through to Astro where applicable.

Mintlify migration preserves native `.mdx` sources by default. Add `--format markdown` for the more limited plain-Markdown conversion. Imported MDX keeps JavaScript execution disabled; custom executable components require separate review and an explicit YAML opt-in.

## Generate a project

This is a private internal preview, not a published npm release. In the private template checkout, run `npm run release:pack` and use the copyable local-tarball creation command it prints. `npm run create -- <directory>` is also available **in the template checkout**; generated sites use `npm run docsy -- create <directory>` when another project is needed.

```text
docsy create <directory> [options]
create-docsy <directory> [options]
```

| Option | Meaning |
| --- | --- |
| `--name <name>` | Product or API name |
| `--openapi <source>` | OpenAPI JSON/YAML file or HTTPS URL |
| `--api-base <url>` | Request base URL used in API examples |
| `--base <path>` | Documentation mount path; defaults to `/docs` |
| `--open` | Generate a public static site; this is the default |
| `--locked` | Generate a server-rendered permission-gated site |
| `--yes`, `-y` | Accept defaults without interactive prompts |
| `--no-install` | Leave dependency installation to the caller |
| `--ci` | Include validation and static-preview artifact workflow |
| `--deploy none\|github-pages` | Optional gated deployment workflow; default `none` |
| `--repo <https://github.com/OWNER/REPO>` | Configure source links; required for Pages scaffolding |
| `--force` | Replace an existing target directory |
| `--help`, `-h` | Show command help |

Without `--yes`, the generator asks for the missing product, source, mount path, and access choices.

Pages scaffolding derives `site.origin`, `site.basePath`, and the home URL from the repository. It rejects locked mode. It never creates repositories or deploys; the owner must explicitly enable Pages and set `DOCSY_ENABLE_PAGES=true` when ready. Generated sites remain private packages and record template provenance under `.docsy/template.json`.

## Validate configuration

```bash
docsy validate
```

Validation expands environment placeholders, parses `docsy.config.yaml`, checks it against the configuration schema, and runs Astro's type and template checks. Invalid configuration reports the exact YAML path.

It also renders articles/components, expands snippets, checks API contracts and examples, loads SDK inputs, and verifies internal routes and heading anchors for each version/locale context. Production builds additionally check links in the generated static HTML. Validation does not execute examples against live services.

`docsy check` is an alias for the same operation.

## Build production output

```bash
docsy build
```

The build clears previous `dist/` and `release/` output, validates the project, runs the Astro build, and stages a production release.

- Open mode with `agent.query: false` creates a static `dist/` build and a mount-aware `release/` directory.
- Locked mode or `agent.query: true` creates the standalone Astro server in `dist/`; static staging is skipped. Run it on Node with `npm start` or on Bun with `npm run start:bun`.

## Run production output

```bash
docsy preview
```

Use `HOST` and `PORT` to change the listener:

```bash
HOST=0.0.0.0 PORT=8080 docsy preview
```

`docsy start` is an alias for the same operation.

## Select another configuration

Every command reads `docsy.config.yaml` by default. Set `DOCSY_CONFIG` to select another project-relative file:

```bash
DOCSY_CONFIG=docsy.preview.yaml npm run build
```

## Maintain documentation

```bash
docsy maintain plan --base HEAD~1
docsy maintain run --base HEAD~1
docsy maintain run --base HEAD~1 --pr --target-branch main
docsy maintain verify --base HEAD~1 --patch .docsy/maintenance/proposed.patch
```

`plan` compares committed revisions and writes an impact report and agent prompt under `.docsy/maintenance/`. It never calls a model. Use `--head <ref>` to select the comparison head; it defaults to `HEAD`.

`run` requires a clean checkout, enabled YAML maintenance settings, and an authenticated Codex CLI. It updates documentation and runs independent validation, leaving the diff for review. `--pr` additionally commits to a dedicated branch, pushes, and opens a draft with the GitHub CLI. The target defaults to the repository's default branch.

`verify` applies an optional patch in a clean checkout, enforces editable Markdown and YAML boundaries, and validates the site. The GitHub workflow uses this command in a fresh job before PR publishing. Failed validation produces no validated patch.

See **Documentation maintenance** for the YAML options, GitHub setup, and the distinction between structural API findings and agent review.

