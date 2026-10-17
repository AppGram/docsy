Docsy's CLI wraps Astro with configuration validation, project generation, build staging, and production startup.

## Project commands

The generated `package.json` exposes these scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Astro's development server |
| `npm run validate` | Validate YAML and type-check the site |
| `npm run build` | Validate, build, and stage production output |
| `npm run preview` | Serve the staged static site or standalone locked server |
| `npm run create -- <directory>` | Generate another editable Docsy project |

Arguments after the command are passed through to Astro where applicable.

## Generate a project

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
| `--force` | Replace an existing target directory |
| `--help`, `-h` | Show command help |

Without `--yes`, the generator asks for the missing product, source, mount path, and access choices.

## Validate configuration

```bash
docsy validate
```

Validation expands environment placeholders, parses `docsy.config.yaml`, checks it against the configuration schema, and runs Astro's type and template checks. Invalid configuration reports the exact YAML path.

`docsy check` is an alias for the same operation.

## Build production output

```bash
docsy build
```

The build clears previous `dist/` and `release/` output, validates the project, runs the Astro build, and stages a production release.

- Open mode creates a static `dist/` build and a mount-aware `release/` directory.
- Locked mode creates a standalone Node server in `dist/`; static staging is skipped.

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

