# Private adoption evidence

These are local test results for `0.4.0-internal.0`, not a public release or certification of every supported library.

- `adoption.json`: generator versions, source/artifact hashes, counts, rendering checks, and the maintenance case boundary.
- `mintlify-migration.json`: the pinned public Mintlify starter export, imported pages/assets, redirect map and manual-review warnings. Its converted site passed a production build and link checks. `MINTLIFY-LICENSE` preserves its notice.
- `zod-maintenance.patch`: the actual coding agent's documentation diff after adopting Zod's real bundled v4 error API instead of v3. The error alias change was observed in the real runtimes, not invented in a fake API.
- `zod-pr-body.md`: review description produced after independent scope checks, an executed assertion against the documented JavaScript example, and a production build. `ZOD-LICENSE` preserves upstream attribution.

The first validation attempt correctly blocked the Zod case because imported source snapshots were treated as executable portal TypeScript. After correcting the template's ingestion-data exclusion, the same agent-authored patch passed independent verification. The generated template now excludes `sources/` from portal type-checking; SDK correctness still belongs to the SDK's own build pipeline.

No GitHub PR was opened, preview hosted, npm package published, or repository made public. The rendered preview is a local artifact; the workflow's private static-preview attachment is covered by regression tests. A future end-to-end GitHub case should be reviewed before making a public PR-quality claim.

Reproduce larger-library imports/rendering with `npm run test:imports:real`. The optional `npm run test:maintenance:real` invokes your authenticated coding agent and may consume quota, but never pushes or opens a remote PR. It uses real Zod v3/v4 exports bundled in the pinned package, not a claim about a newly released version.
