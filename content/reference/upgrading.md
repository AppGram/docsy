Generated Docsy sites own their Astro source. That means `npm update` does not merge new Docsy components into a customized project.

## Record the baseline

New projects include `.docsy/template.json`: generator version, deployment selection, and SHA-256 hashes of the initial framework files. Commit this file. YAML, authored content and your package settings remain yours; the manifest is not an automatic updater.

## Compare a new template safely

Generate a separate, untouched project from the desired Docsy package. Use the same deployment options as your current site. From your existing site, run:

```bash
npm run docsy -- upgrade --from ../fresh-docsy
```

This writes a local report under `.docsy/upgrades/`, never overwriting, deleting or installing project files. It distinguishes upstream changes, local-only changes, conflicts and proposed removals. The candidate must match its own generation manifest; a customized candidate is rejected.

Review the report and compare files with the clean project. Merge only the changes you want on a branch. Review dependency and workflow changes separately; preserve your content, branding and access settings. Run validation, the build, your own example tests and a rendered preview before merging. Keep the old baseline until all relevant changes have been reviewed; never replace it merely to hide conflicts.

## Older generated sites

Do not invent hashes for an unknown baseline. Recover the exact generator release or commit originally used and generate a clean project from it. Review differences with your existing site before adopting provenance. If the original release is unavailable, use a manual source comparison and record that the baseline is unknown. The comparison command refuses to guess.

## Release candidates and published versions

Use a specific registry version such as `@appgram/docsy@0.4.3` to generate a clean upgrade baseline. `npm run release:pack` creates a local tarball for testing unreleased changes; it does not publish to a registry. Only versions actually listed in npm are registry releases. Publication requires the separate manual release workflow, owner-controlled gate and explicit confirmation. Generated documentation projects stay private npm packages by default.
