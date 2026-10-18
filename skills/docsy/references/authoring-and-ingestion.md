# Authoring and ingestion

Read the installed `src/config.ts` and the source you are changing. Examples below are **patches to merge into existing YAML**, not complete replacement configurations. Preserve other articles, navigation, defaults and source overrides.

## Register articles and navigation

Create `content/authentication.md` with its body starting at `##` when YAML supplies the page title. Keep protected sources outside `public/`.

```yaml
content:
  articles:
    - slug: authentication
      source: content/authentication.md
      title: Authentication
      description: Authenticate API requests.
      eyebrow: GUIDE
navigation:
  - title: Guides
    items:
      - title: Authentication
        href: /guides/authentication
```

The source creates `/guides/authentication` beneath `site.basePath`; navigation determines placement. Nested slugs create nested routes. Titles/descriptions come from registration metadata, including for MDX; optional MDX frontmatter does not override it.

For `.md`, Docsy supports directive callouts, ordered steps, tabs, accordions, code groups and registered snippets. Example:

```markdown
:::note[Keep tokens private]
Use a token from the correct environment.
:::
```

Named includes use `::include{src="publishing"}` with `content.snippets.publishing: content/snippets/publishing.md`. Do not treat fenced include examples as real includes or bypass cycle/path checks.

## Native MDX

Change the article's `source` to a `.mdx` file and use JSX components instead of Markdown directives:

```yaml
content:
  mdx:
    enabled: true
    allowJavaScript: false
    components: {}
```

```mdx
<Note title="Keep tokens private">
Use a token from the correct environment.
</Note>

<Tabs group="runtime">
  <Tab title="Node">Use the Node runtime.</Tab>
  <Tab title="Bun">Use the Bun runtime.</Tab>
</Tabs>
```

Built-ins include `Note`, `Info`, `Tip`, `Check`, `Warning`, `Danger`, `Tabs`/`Tab`, `Steps`/`Step`, `Accordion`/`AccordionGroup`, `CodeGroup`, `Card`/`CardGroup`, and `Frame`. Containers have structural constraints: Tabs contain Tabs' `Tab` children, Steps contain `Step` children, and CodeGroup contains fenced code blocks. Use `title` for labels, `group` or `sync` for tab synchronization, and literal `cols={2}` for CardGroup.

`content.components` enables the matching groups (`note`, `tip`, `warning`, `danger`, `tabs`, `steps`, `accordion`, `code-group`, `include`, `card`, `frame`). An explicit list replaces the defaults; preserve needed groups.

Declarative MDX accepts quoted attributes and literal values but rejects imports/exports, variable/function expressions, spreads, unsafe markup and unknown components. For explicitly trusted executable content, `allowJavaScript: true` supports local imports and `components: { ApiStatus: content/components/ApiStatus.tsx }`; modules must default-export React components. Keep modules in `content/` for the standard Docker copy boundary. This is not a JavaScript sandbox or an arbitrary browser-widget loader.

## Configure the existing interface

- `site`: name, title, description, origin, basePath, logo, logoDark, favicon and links. Local `assets/...` paths refer to files in `public/assets/`.
- `header`: search labels, Markdown label and optional CTA. `footer` is optional branding, not the software's legal notices.
- `eyebrow`: `icon: assets/mark.svg`, `triangle`, or `none`; size is 8–32 pixels. Images render as monochrome theme-aware masks.
- `home`: copy, actions, `articleLayout: grid|list`, optional `image`. Removing the image block leaves the capability available but displays no image.
- `theme.mode`: first-visit light/dark default, not a forced permanent mode. Reader choice persists.
- `theme.colors`: default-mode palette. `darkColors`/`lightColors` override alternate palettes. Use `ink`, `muted`, `line`, `paper`, `accent`, and `panel`; test text against its actual surface.
- `theme.code.lightTheme`/`darkTheme`: bundled Shiki themes. Supply a language on fences. Highlighting and logos are local; missing grammars fall back to escaped plain text.

Inspect existing font settings; do not copy a new font stack from an example just to change colors. Keep licensing/copyright notices in software distributions even when visible page branding is replaced.

## OpenAPI

```yaml
ingestion:
  openapi:
    enabled: true
    source: sources/openapi.yaml
    apiBaseUrl: https://api.example.com
    sections:
      - section: users
        title: Users
        tags: [users]
        paths: [/v1/users]
    examples:
      languages: [curl, typescript, python, go, swift, kotlin, dart, csharp]
      defaults: required
      customSamples: true
```

Supports Swagger 2/OpenAPI 3, local JSON/YAML and HTTPS sources. Prefer committed local snapshots for deterministic/private builds. An API section creates `/api/users`; register its sidebar link separately. Tag/path matching uses case-insensitive containment; either match includes an operation and sections may overlap.

HTTP request snippets and native SDK imports are separate capabilities. `examples.languages` selects HTTP targets from the installed `src/lib/request-languages.ts`; do not invent SDK method names. Operation `x-codeSamples` can supply real SDK calls. Examples are displayed/copied, not browser-executed. Keep credentials as placeholders; complex OpenAPI parameter serialization styles are not fully implemented.

To disable OpenAPI for an articles-only portal, set `enabled: false`; the current schema still requires `source` and `apiBaseUrl` fields. Do not leave default sample API navigation pointing at disabled pages.

## Native SDK inputs

```yaml
ingestion:
  sdks:
    - id: typescript
      slug: typescript-sdk
      adapter: typedoc
      source: sources/typescript/api.json
      name: TypeScript SDK
      language: typescript
      install: npm install @example/sdk
      overview: Typed API client.
```

The entry creates `/typescript-sdk`; sidebar placement is separate. Sources are local files/directories: SDK loaders do not fetch remote artifacts, unpack archives or run generators. Use real output from the upstream generator and document its version. Do not relabel a teaching fixture as a production library test.

Choose by actual artifact format, not just programming language:

| Native adapter | Expected artifact |
| --- | --- |
| `typedoc`, `jsdoc` | TypeDoc project JSON; JSDoc `-X` doclets |
| `sphinx` | Sphinx JSON-builder directory (`.fjson`) |
| `javadoc`, `dokka`, `scaladoc` | Standard Javadoc, Dokka, Scaladoc 2 HTML |
| `docfx` | ManagedReference YAML, including C#/F#/VB APIs |
| `doxygen` | XML directory for C/C++/Objective-C |
| `godoc` | `go doc -all` plain text |
| `rustdoc` | Stable rustdoc HTML, not nightly JSON |
| `docc` | Swift DocC archive/data with render-node JSON |
| `dartdoc` | Native Dartdoc HTML directory; legacy JSON index has fewer details |
| `phpdoc`, `yard`, `exdoc`, `ldoc` | phpDocumentor `structure.xml`; YARD, ExDoc, LDoc HTML |

`swift-symbols` consumes AppGram/docc2json converter output, not raw symbol graphs. Consume an existing DocC artifact or converter output; do not start Xcode builds as a Docsy ingestion step. `typedoc-lite` is an authored compact interchange schema, not evidence of a native generator integration. Pdoc and raw C# XML are not direct native adapters; use Sphinx or DocFX.

Declarations, remarks, examples, parameters and deprecations are retained where the generator and adapter expose them. Format/theme changes may need adapter work. Respect `maxFiles`, `maxFileBytes`, `maxTotalBytes`, symlink and XML-entity protections; diagnose the offending artifact before changing bounds. Use `npm run test:imports:real` in a development checkout for the existing larger-library proof, not as a prerequisite for every prose edit.

## Versions and localization

Declare IDs in `versions.items` and locale codes in `localization.locales` before using them in articles. Defaults are `versions.default` and `localization.defaultLocale`; `fallback: false` omits untranslated articles rather than substituting prose. Register the same slug with different `version`, `locale` and `source` for variants; duplicate slug/version/locale entries fail.

Selection first chooses the version-specific pool, otherwise shared registrations; it then chooses the locale or default-locale fallback. A specific version does not borrow a different version's article. A version pool with no suitable locale does not automatically restore the shared pool. Only the default context has the short route; other contexts use `/versions/<version>/<locale>/...` beneath the base.

API and SDK sources accept `versions: { v1: sources/v1/... }` overrides. Use navigation `titles`, `home.translations` and `localization.messages` for UI/copy translations. Importing a version or enabling a locale does not translate content automatically.
