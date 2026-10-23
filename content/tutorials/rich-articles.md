Docsy articles support declarative Markdown components. Product configuration stays in YAML; the article body stays in Markdown. No React, MDX, remote fonts, or hosted editor is required.

## Callouts

:::note[Configuration belongs in YAML]
Keep product identity, navigation, sources, and permissions in `docsy.config.yaml`. Write the explanation here, in Markdown.
:::

:::tip[Validate before you publish]
Run `npm run validate` to catch broken links, invalid components, and ingestion errors before they reach your readers.
:::

:::warning[Keep secrets out of source]
Read API credentials from the server environment. Never commit private tokens to YAML or publish them in an example.
:::

:::danger[Static files cannot enforce permissions]
Use the Node or Bun server for locked documentation. A public static host cannot protect private article content with a browser-only gate.
:::

Each kind has its own icon and restrained accent, with readable surfaces in both themes. The title explains the situation; the body tells the reader what to do. Color is not the only way to distinguish them.

Write a callout like this:

```md
:::warning[Keep secrets out of source]
Read API credentials from the server environment, not committed YAML.
:::
```

## Numbered steps

:::steps
1. **Generate a project.** Start with the editable Docsy interface.

2. **Configure your sources.** Register Markdown, API contracts, and SDK metadata in YAML.

3. **Validate and publish.** Review the built result before deployment.
:::

Wrap a Markdown ordered list in `:::steps` and close it with `:::`. Nested paragraphs and code fences are supported inside list items.

## Synchronized tabs

Choose a package manager. Other tab groups with the same `sync` key remember the same label across pages, using local storage only.

::::tabs{sync="package-manager"}
:::tab[npm]
```bash
npm run validate
npm run build
```
:::
:::tab[pnpm]
```bash
pnpm validate
pnpm build
```
:::
::::

The outer group uses four colons so that its three-colon tab children can nest. Tabs support arrow keys, Home, End, focus indicators, and a readable all-panels fallback without JavaScript.

`````md
::::tabs{sync="package-manager"}
:::tab[npm]
```bash
npm run build
```
:::
:::tab[pnpm]
```bash
pnpm build
```
:::
::::
`````

## Code groups

Use `:::code-group` around fenced code blocks to create language tabs. The fence's metadata, or language when metadata is absent, supplies each tab label.

Fenced code is highlighted at build time, including inside groups, tabs, callouts, and snippets. Code cards show the language's local logo, retain an accessible language label, and copy plain source code. The portal's light/dark toggle changes token colors automatically; configure palettes with `theme.code.lightTheme` and `theme.code.darkTheme`. The **Default UI** guide documents code appearance and logo overrides.

:::code-group
```javascript JavaScript
console.log('Documentation owned by your team.');
```
```python Python
print('Documentation owned by your team.')
```
:::

## Expandable explanations

:::accordion[What happens without JavaScript?]
All tab content stays visible, steps remain readable, and accordions use the browser's native details element. Search indexes every tab's content, not only the currently selected panel.
:::

## Reusable snippets

Register named local Markdown files in YAML:

```yaml
content:
  snippets:
    publishing: content/snippets/publishing-checklist.md
```

Then insert `::include{src="publishing"}` on its own line. The result below is shared content:

::include{src="publishing"}

Includes are expanded in rendered articles, search, JSON documents, and Markdown exports. Unknown names, includes outside the project, circular references, and more than ten nested includes stop validation. Include directives inside fenced examples are not expanded.

## draw.io diagrams

Use SVG or PNG exports for technical architecture diagrams. Register the preview and optional editable `.drawio` source in `content.diagrams`, then embed `::drawio{src="architecture"}`. MDX supports `<Drawio src="architecture" />`. Diagrams share the fullscreen image viewer and remain protected with their article.

See [draw.io diagrams](/guides/tutorials/drawio-diagrams) for a working example, YAML, source downloads, and supported export boundaries.

## Mermaid and UML diagrams

Use `mermaid` fences in Markdown or MDX for flowcharts and UML class, sequence and state diagrams. The local renderer follows the site's fonts and active palette, and diagrams open in the fullscreen zoom/pan viewer. Source stays available to readers and coding agents.

PlantUML SVG/PNG exports support optional editable `.puml` downloads through `::plantuml{src="id"}` or `<PlantUml src="id" />`. Raw PlantUML is not executed or sent to a remote renderer. See [Mermaid and UML diagrams](/guides/tutorials/mermaid-and-uml) for working examples and YAML configuration.

## Images and videos

Article images open in a fullscreen viewer when clicked. Videos keep their native inline controls and get an **Expand video** button. The viewer follows the portal's light/dark theme and offers image zoom, captions, previous/next controls, and an original-file link. Escape closes it and returns focus to the trigger. Opening a video pauses the inline player and preserves its time position without starting audio automatically.

Scroll or pinch to zoom around the pointer, then drag to pan. The toolbar shows the actual zoom percentage and provides minus, plus, and fit/actual-size controls. Double-click (or double-tap) toggles fit and actual size; zoom is bounded between fit and 800%. Keyboard shortcuts: `+`/`-` zoom, `0` or `f` fits the image, and `1` selects actual size. Arrow keys pan while zoomed, and navigate media while fitted. Video controls retain their native seeking keys. Zoom resets when moving to another item; resizing keeps a fitted image fitted.

Configure this independently of the article component list:

```yaml
content:
  media:
    enabled: true
    images: true
    videos: true
```

Set `enabled: false` to disable the viewer, or turn off only `images` or `videos`. These settings default to `true`, including in generated projects. Without JavaScript, images and video controls remain ordinary page content.

Markdown images work normally. For native video and captions, use HTML in Markdown or the same elements in declarative MDX:

```mdx
<figure>
  <video controls playsInline preload="metadata" poster="/assets/demo-poster.png" aria-label="Product walkthrough">
    <source src="/assets/demo.webm" type="video/webm" />
    <track src="/assets/demo.en.vtt" kind="captions" srcLang="en" label="English" default />
  </video>
  <figcaption>A short product walkthrough.</figcaption>
</figure>
```

Add these files to `public/assets/` for public media; MDX rebases the root-relative paths above to `site.basePath`. In raw Markdown HTML, write URLs relative to the served page or include your configured base path yourself. Raw HTML uses lowercase attributes such as `playsinline` and `srclang`, rather than MDX's `playsInline` and `srcLang`. Do not put confidential media in `public/`: those files bypass access gates.

`figcaption` supplies the viewer caption, falling back to the image's title or alt text, or the video's accessible label. Add `data-docsy-media="off"` to a media element or its surrounding figure to leave it inline only. Linked images retain their original link behavior; decorative icons and code-language logos are excluded. Source-owned layouts can opt an image or video inside `.docs-content` into the viewer with `data-docsy-media="true"`.

This is a native HTML video player, not a YouTube/Vimeo iframe integration. No external player scripts, fonts or analytics are loaded.

## Choose supported components

The default is all supported components. Restrict the set for a project in YAML:

```yaml
content:
  components: [note, tip, warning, danger, steps, tabs, accordion, code-group, include]
```

`tab` is an internal child of `tabs`, not a standalone component. Unknown components, orphan tabs, disabled components, and invalid code-group contents fail validation. Rendered colors use the existing theme tokens; component styling lives in `src/styles/article-components.css`.
