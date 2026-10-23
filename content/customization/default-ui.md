Every generated project starts with Docsy's default interface: responsive sidebar navigation with remembered scroll position, search, Markdown export controls, content cards, API and SDK layouts, and an on-page heading rail. The interface is normal Astro source in the generated repository.

Sidebar icons are also YAML-configurable: choose `icon: lucide:book-open` or `icon: tabler:api`, or use your own image with an optional dark-mode variant. [Configure sidebar icons](/guides/tutorials/yaml-configuration#sidebar-icons-packs-or-your-own-assets).

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

footer:
  prefix: Docsy provided by
  label: Acme
  href: https://example.com
```

Paths under `public/` are referenced without the `public` segment. Docsy adds `site.basePath` to local asset and documentation links.

The footer is optional. Remove the entire `footer` block to render no attribution footer. ELv2 does not require visible Docsy or AppGram branding on your published documentation; its notice requirement applies to the license and copyright notices distributed with the software.

## Choose the eyebrow icon

The small marker beside each page's eyebrow uses the Docsy SVG by default. Choose your own SVG or transparent image in YAML:

```yaml
eyebrow:
  icon: assets/acme-mark.svg
  size: 14
```

Put local icons under `public/`; Docsy adds `site.basePath` automatically. Icons render as monochrome masks in the eyebrow's text color, so they follow both light and dark palettes. `size` is in pixels, from 8 to 32.

Set `icon: triangle` for the original triangle, or `icon: none` to hide the marker. This global setting applies to every page; `home.eyebrow` and each article's `eyebrow` still control the text.

## Choose grid or list for articles

Set the overview's authored-article layout in `docsy.config.yaml`:

```yaml
home:
  articleLayout: list # grid or list; defaults to grid
```

`grid` shows two columns of article cards on wide screens and one on narrow screens. `list` shows compact full-width rows, with category labels alongside the title and description on wide screens and above them on narrow screens. Both layouts use each article's YAML title, description, and eyebrow, and follow the active theme colors. This setting does not change the article reading page or API reference cards. Invalid layout values stop the build.

## Add an optional overview image

The overview has no image by default. To display your own, put it under `public/` and add `home.image` in YAML:

```yaml
home:
  # Keep your existing title, description, and actions.
  image:
    src: assets/overview.png
    alt: A preview of the Acme platform
    width: 1200
    height: 800
```

`width` and `height` are optional. Remove the `image` block to return to the full-width text layout. Images retain their original colors in light and dark themes.

## Use the default visual tokens

Set only the mode to use Docsy's defaults:

```yaml
theme:
  mode: light
```

The header includes a light/dark toggle. `theme.mode` is the first-visit default, and the visitor's selection is saved locally for later pages and sessions.

Search uses the same palette: its surface, text, result badges, selection highlight, borders, and keyboard hints follow the active theme and your YAML overrides.

## Syntax highlighting and language logos

SDK declarations and examples, OpenAPI requests and responses, and Markdown fences all use the same build-time syntax renderer. Code groups, tabs, callouts, and included snippets use it too. Highlighting is included in the generated HTML: no highlighter script, CDN, icon font, or external font request is needed in the browser.

Choose the two bundled Shiki palettes in YAML. Switching the portal theme also switches token colors without reloading:

```yaml
theme:
  code:
    lightTheme: github-light
    darkTheme: github-dark-high-contrast
```

Use any bundled [Shiki theme](https://shiki.style/themes). An unknown theme name fails configuration validation. The code-card surface follows Docsy's light/dark styling; these settings control syntax token colors.

Put the language after a Markdown fence, such as `typescript`, `scala`, `python`, `yaml`, or `json`. Common aliases such as `ts`, `js`, `sh`, `objc`, and `vbnet` work. A missing/unknown language stays safely escaped plain text instead of guessing a grammar. Blocks over 100,000 characters also use plain text to bound highlighting work. Inline code labels remain inline code, not standalone syntax-highlighted cards.

Each code header uses its language logo rather than an uppercase name. The language name remains available as an accessible label and tooltip. Native SDK badges respect the SDK's YAML `icon` and optional `iconDark` overrides; other supported logos are served locally. Languages/formats without a logo use a neutral code or terminal symbol. F# examples retain the F# mark even where DocFX emits a C# declaration with a C# mark.

The shared renderer is `src/lib/code-renderer.ts`, language aliases and default logo mappings are in `src/lib/code-languages.ts`, and card/token styling is in `src/styles/code-blocks.css`. Copy buttons copy plain code, never syntax markup.

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

## Copy links to sections

Section headings reveal a small `#` button on hover or keyboard focus. Click it to copy the current page's full URL with that section's existing fragment, including the documentation version and language path. A checkmark confirms the copy without moving the reader or changing browser history. Touch devices keep the buttons visible.

This works for anchored Markdown/MDX headings, API endpoint titles, SDK categories and SDK symbols. It does not rename existing anchors or add button labels to exported Markdown/search content. Disable the controls in YAML if you prefer:

```yaml
reader:
  headingLinks: false
```

The default is `true`. Clipboard restrictions fall back to the browser's copy command; if both are denied, the control reports failure instead of claiming success.

## Edit the source-owned interface

YAML is not a page-builder language. When the layout or interaction should change, edit the source directly:

| Responsibility | Location |
| --- | --- |
| Global documentation shell | `src/layouts/DocsLayout.astro` |
| Guide cards on the overview | `src/components/docs/ArticleCard.astro` |
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

