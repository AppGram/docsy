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

## Internal builds only

This checkout is an internal prerelease. `npm run release:pack` creates a versioned local tarball; it does not publish to a registry. The root package is marked private to block accidental npm publication. Public distribution requires a separate explicit release decision.
