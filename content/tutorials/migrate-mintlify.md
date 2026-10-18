Import a **local source export**, not a hosted website. Native `.mdx` files stay MDX by default; supported JSX components render with Docsy's existing UI. The source directory is never modified, source JavaScript is never executed by the importer, and the destination must be new and outside that directory.

## Run the importer

From an existing Docsy checkout or generated site:

```bash
npm run docsy -- migrate mintlify \
  --source ../mintlify-export \
  --out ../migrated-docs \
  --base /docs \
  --ci

cd ../migrated-docs
npm install
npm run validate
npm run build
npm run preview
```

Add `--repo https://github.com/OWNER/REPOSITORY` to configure article source/edit links. Migration never pushes, creates a repository, or deploys. Review `migration/report.json` before adopting the result.

The generated YAML enables MDX with `content.mdx.allowJavaScript: false`. To deliberately use the older, limited conversion to plain Markdown, add `--format markdown`. [Native MDX authoring](../native-mdx) explains components, YAML settings, custom modules and the trust boundary.

## What is preserved

- Explicit navigation groups/pages in `docs.json` or legacy `mint.json`, nested groups, and tabs containing groups. Tab groups become labelled navigation sections.
- Article titles/descriptions, Markdown and native MDX bodies, internal links, and page ordering.
- Referenced local images/PDFs and configured logos, copied under `public/assets/migrated/`; unrelated files, fonts, credentials, scripts, and orphan pages are not copied.
- Original article paths, frontmatter aliases, and explicit redirect entries, mapped to their new `/guides/...` routes. Redirects are scoped by `site.basePath`, not domain-root redirects.
- Native Note/Info/Tip/Check/Warning/Danger callouts, nested callouts, Tabs/Tab, Steps/Step, Accordion/AccordionGroup, CodeGroup, Card/CardGroup and Frame components, using Docsy's theme. Literal attributes such as `cols={2}` are supported without enabling executable JavaScript.
- Fenced and inline code examples remain unchanged; AST-based link rewriting handles Markdown links/images, MDX reference definitions, and quoted JSX `href`/`src` attributes.

The report records source and asset hashes, route mappings, warnings, and `published: false`. Preserve upstream license/notice files along with imported content.

The native path has been built against the two real articles from `mintlify/starter` at commit `8dc589095a85335165d18ed0aa5d273360dffd04`, preserving its cards, callouts, numbered steps and code examples. The internal evidence file `docs/evidence/mintlify-native-mdx.json` records the source hashes and checks. This small starter is a compatibility smoke test, not proof that every production Mintlify site will migrate unchanged.

## Explicit limits

Unknown components, unsupported HTML/props, executable imports/exports and non-literal JavaScript expressions fail before destination creation. The importer never turns on trusted JavaScript or copies arbitrary component modules. Map custom components manually after reviewing their code; there is no claim of universal Mintlify component compatibility.

Dynamic/API navigation, missing linked pages, symlinks, and unsafe paths also fail. Export one version/locale first; multi-context navigation is not silently flattened. There are file, page-count, and total-byte limits. With `--format markdown`, conversion retains the previous narrower limits: only simple cards/steps/callouts, without nested callouts, reference-style links or custom JSX.

OpenAPI setup needs Docsy's existing OpenAPI importer; it is not inferred from generated API navigation. Global header links, SEO settings, contextual actions, custom JavaScript, advanced component behavior, and original visual styling require manual mapping. Remote links/assets are retained as URLs, not downloaded. This is a bounded migration path, not universal Mintlify compatibility.

## Correct a page after migration

```yaml
reader:
  editUrl: https://github.com/OWNER/REPOSITORY/edit/main/{source}
  reportUrl: https://github.com/OWNER/REPOSITORY/issues/new
  editLabel: Edit this page
  reportLabel: Report a problem
```

Edit URLs support `{source}`, `{version}`, and `{locale}` placeholders. Reports prefill the canonical page URL, version, and locale, not runtime query parameters. Links are optional and make no network request until clicked. Localize labels through `localization.messages` keys `editPage`, `reportProblem`, and `documentationFeedback`. Users need repository access for a private project.
