Docsy articles support declarative Markdown components. Product configuration stays in YAML; the article body stays in Markdown. No React, MDX, remote fonts, or hosted editor is required.

## Callouts

:::note[Configuration belongs in YAML]
Use a callout to explain a constraint without interrupting the guide. The `note`, `tip`, `warning`, and `danger` components share the active theme's colors.
:::

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

## Choose supported components

The default is all supported components. Restrict the set for a project in YAML:

```yaml
content:
  components: [note, tip, warning, danger, steps, tabs, accordion, code-group, include]
```

`tab` is an internal child of `tabs`, not a standalone component. Unknown components, orphan tabs, disabled components, and invalid code-group contents fail validation. Rendered colors use the existing theme tokens; component styling lives in `src/styles/article-components.css`.
