:::note[You are in the Preview demo]
This is a separate version of the getting-started article, provided to test Docsy’s version and language routing. It is not a released version or a promise of future product features.
:::

## What is different in this version?

The Current guide explains how to create a documentation project. This Preview guide is a small testing workspace instead. Its title, description, and body come from `content/preview/getting-started.md`, registered with `version: preview` in YAML.

The same slug, `getting-started`, keeps the reader on the equivalent page when they switch versions. Other guides remain shared because they do not have a version-specific override.

## Try version switching

:::steps
1. **Select Current.** You should see the original project setup guide.

2. **Select Preview (demo).** You should return to this testing workspace with a beta notice.

3. **Select Français.** The preview version stays selected and this page changes to its French translation.
:::

## Try language fallback

With Français selected, open **Configuration YAML** from the sidebar. That guide intentionally has no French translation, so Docsy displays the English content with a fallback notice. The version and language selectors stay on Preview and Français.

## Try context-aware search and exports

Search for **testing workspace** in English Preview, then compare the results in Current. The query stays scoped to the selected context. The Markdown menu and JSON alternate link also point to this version, not the Current article.

```text
/docsy/agent/pages/versions/preview/en/guides/getting-started.json
```

:::tip[Nothing changed in the generator]
These demo contexts are configured only for Docsy’s own portal. Newly generated projects still start with one version and their default language.
:::
