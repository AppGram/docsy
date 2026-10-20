Use draw.io SVG or PNG exports in Markdown and MDX articles, with a caption and an optional download of the original `.drawio` file. Diagrams use Docsy’s fullscreen viewer: click to expand, scroll or pinch to zoom, drag to pan, and press Escape to close.

## Example: documentation pipeline

::drawio{src="documentation-pipeline"}

This source-owned example includes an editable `.drawio` document and a matching SVG preview. Static hosting serves public documentation; permission gates and live agent queries require Node or Bun.

## Export from draw.io

1. Save your editable diagram as a `.drawio` file.
2. Choose **File → Export as → SVG** for a sharp vector diagram, or **PNG** for a raster preview. Embed any images and fonts in the export: remote resources are rejected so readers do not contact a third-party host.
3. Store both files under `content/diagrams/`, not `public/` when the article is protected.
4. Register the preview and optional source in YAML.

```yaml
content:
  diagrams:
    architecture:
      image: content/diagrams/architecture.drawio.svg
      source: content/diagrams/architecture.drawio
      alt: Clients reach the API through an authentication gateway.
      caption: Requests are authorized before they reach internal services.
      background: light
      sourceLabel: Download source
```

Use `.drawio.png` or `.png` in `image` for a PNG export. `alt` is required. Omit `source` to hide the download link; `sourceLabel` changes its text. `background` can be `light` (default), `dark`, or `transparent`. It applies to both the inline preview and expanded image, so a transparent export with dark labels remains readable in a dark portal.

Each file must be local, inside the project, and at most 5 MiB. Previews must be well-formed SVG or PNG with bounded dimensions. SVG scripts, handlers, external images/styles/fonts and XML entities are rejected. Embedded fonts remain inside their SVG image; they do not change the portal’s font stack.

## Use in Markdown

Use the YAML registration key rather than a filesystem path:

```md
## Technical architecture

::drawio{src="architecture"}
```

## Use in MDX

The built-in component works in declarative MDX without imports or executable JavaScript:

```mdx
## Technical architecture

<Drawio src="architecture" />
```

If you explicitly configure `content.components`, add `drawio` to that list. It is included in the defaults. Fullscreen expansion follows `content.media.enabled` and `content.media.images`; disabling the viewer leaves the preview and source download available.

## Access and agent exports

Diagram bytes are embedded only in the rendered article, not copied into a public asset directory or a separate unprotected download route. A locked article’s existing permission checks therefore also protect its preview and source download. Do not put protected originals in `public/`, which is always publicly accessible.

Captions participate in full-text search. Markdown/JSON exports include the supplied description and caption, not large base64 images or native XML. Give agents a useful textual explanation alongside any important architecture diagram.

This integration displays exports and offers source downloads. It does **not** automatically render raw `.drawio` XML, open an online editor, or synchronize the preview after the editable source changes. Re-export the SVG/PNG when you update the diagram and review both files together.
