Every generated project starts with Docsy's default interface: responsive sidebar navigation, search, Markdown export controls, content cards, API and SDK layouts, and an on-page heading rail. The interface is normal Astro source in the generated repository.

## Configure branding in YAML

Routine brand changes belong in `docsy.config.yaml`:

```yaml
site:
  name: Acme
  docsLabel: docs
  title: Acme Documentation
  description: Build with the Acme platform.
  origin: https://docs.example.com
  basePath: /
  logo: assets/acme-mark.svg
  favicon: assets/acme-mark.svg
  githubUrl: https://github.com/acme/platform

header:
  searchLabel: Search documentation
  searchPlaceholder: Search guides and API reference
  llmLabel: Markdown
  cta:
    label: Open dashboard
    href: https://app.example.com
```

Paths under `public/` are referenced without the `public` segment. Docsy adds `site.basePath` to local asset and documentation links.

## Use the default visual tokens

Set only the mode to use Docsy's defaults:

```yaml
theme:
  mode: light
```

The header includes a light/dark toggle. `theme.mode` is the first-visit default, and the visitor's selection is saved locally for later pages and sessions.

Override individual tokens when the product needs them:

```yaml
theme:
  mode: dark
  colors:
    ink: "#f5f5f5"
    muted: "#a3a3a3"
    line: "#262626"
    paper: "#000000"
    accent: "#ffffff"
    panel: "#050505"
  fonts:
    display: '"Aptos Display", "SF Pro Display", "Helvetica Neue", sans-serif'
    body: '"Aptos", "SF Pro Text", "Helvetica Neue", sans-serif'
    mono: 'ui-monospace, "SF Mono", Menlo, monospace'
```

`theme.colors` customizes the configured default mode. Use `darkColors` when the default is light, or `lightColors` when the default is dark, to customize the alternate palette:

```yaml
theme:
  mode: light
  colors:
    paper: "#ffffff"
    ink: "#111116"
    accent: "#5188ff"
  darkColors:
    paper: "#000000"
    ink: "#f5f5f5"
    accent: "#ffffff"
```

Docsy uses system font stacks by default. It does not require a hosted font service or typographic tracking.

## Edit the source-owned interface

YAML is not a page-builder language. When the layout or interaction should change, edit the source directly:

| Responsibility | Location |
| --- | --- |
| Global documentation shell | `src/layouts/DocsLayout.astro` |
| Authored article presentation | `src/components/docs/ArticlePage.astro` |
| API and SDK presentation | `src/components/docs/` |
| Landing page | `src/pages/index.astro` |
| Base design primitives | `src/styles/docsy.css` |
| Dark-mode adjustments | `src/styles/docsy-dark.css` |

Those files are intentionally copied into generated projects. There is no upstream renderer that replaces local changes during deployment.

## Give an AI a safe customization brief

Generated projects include `AGENTS.md` and `DOCSY_BRIEF.md`. Use them to describe the desired visual result while preserving the configuration boundary:

```text
Read AGENTS.md, DOCSY_BRIEF.md, and docsy.config.yaml.
Keep product copy, article registration, navigation, colors, fonts,
ingestion, and access rules in YAML. Change Astro and CSS only when
the interface itself must change. Preserve responsive behavior,
search, Markdown export, and the permission gate.
```

Validate the result at narrow and wide viewport sizes, then run `npm run validate` and `npm run build`.

