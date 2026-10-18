## Documentation maintenance

Updated error reference and onboarding; registered onboarding and the new migration article. Only permitted Markdown and YAML fields changed. Diff checks passed; builds and validation left to the trusted step.

Compared `c659a45dfac38cbc74391b32a465ae5c12121a34` to `37509bab2b80f28a48947bde2be0cab919198c26`.

## Updated documentation

- `content/errors.md`
- `content/getting-started.md`
- `docsy.config.yaml`
- `content/maintenance/breaking-changes.md`

## Breaking changes and contract review

- None reported.

- Documented removal of the v3 .errors alias in v4; migrate to .issues.
- Explained changed issue shapes, error-map signatures, deprecated helpers, and array mutation behavior.
- Clarified v3/v4 compatibility exports within zod@3.25.76 without inventing a release.

## Stale examples

- Corrected result.error.errors to result.error.issues, preserving the existing JavaScript fence shape.

## Questions for the reviewer

- Committed error snapshots do not establish replacement issues for every parser or instanceof Error behavior for every parse result.

## Validation

- Passed: documentation change scope and protected YAML settings.
- Passed: npm run validate.
- Passed: npm run build.
- Passed user-defined example check: Documented Zod error example on the real v4 runtime

## Rendered preview

Run `npm run preview` in the validated checkout to inspect the rendered site. Static output is in `dist/`.

Review source accuracy and migration instructions before merging this draft.
