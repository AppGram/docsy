Docsy distinguishes **format coverage** from **production compatibility**. Twenty-language teaching fixtures are genuine generator output, but they cannot establish that every real library or generator version works.

## Larger real-library imports

Run this inside the private template checkout after `npm ci`:

```bash
npm run test:imports:real
```

The script copies installed upstream sources without modifying them, invokes actual TypeDoc/JSDoc generators, imports the resulting artifacts through Docsy's native adapters, and asserts representative symbols, declarations, parameters, and unique IDs. It also builds a standalone test portal with all three references and checks the rendered site's links and anchors. Source/output hashes and commands are written to `.docsy/real-projects/report.json`; large outputs remain local and ignored by Git.

| Project tested | Actual input | Generator | Imported symbols | Imported examples |
| --- | --- | --- | ---: | ---: |
| Zod 3.25.76 | Complete v3 source entry and dependencies | TypeDoc 0.28.20 | 2,497 | 0 |
| YAML 2.9.1 | Published declaration entry and dependencies | TypeDoc 0.28.20 | 617 | 0 |
| Lodash 4.18.1 | Complete distributed `lodash.js` | JSDoc 4.0.5 | 393 | 303 |

Counts describe these pinned inputs, not a guaranteed count for future versions. Zod and YAML expose no `@example` blocks through these entry points; Docsy does not invent examples. TypeDoc uses `skipErrorChecking` for artifact generation: this is an ingestion test, not certification of upstream type-checking. Upstream licenses remain in the copied input trees.

Source snapshots under `sources/` are ingestion data, excluded from the portal's TypeScript project. They may reference files that are not part of the docs export. Validate and type-check the actual SDK in its own build pipeline; portal validation does not replace that work.

These tests cover three substantial JavaScript/TypeScript libraries and two native formats. The other eighteen source languages still rely on smaller real-generator fixtures. Expand external-project coverage before promising broad production compatibility. Imported examples are not automatically executed.

The stress build also exposes a current scaling limit: a complete SDK is rendered as one reference page. Zod's test page is roughly 6.9 MB of uncompressed HTML, YAML 1.6 MB, and Lodash 2.3 MB. A successful build is not a page-performance endorsement; large SDKs need carefully scoped inputs today, and symbol-level pagination is still future work.

## Migration evidence

The public [Mintlify starter](https://github.com/mintlify/starter/tree/8dc589095a85335165d18ed0aa5d273360dffd04) was tested at commit `8dc589095a85335165d18ed0aa5d273360dffd04`: two articles, two local logos, internal links, Tip, Cards, Steps, and original-path redirects. The importer converts supported components and reports manual mapping for global/header/SEO behavior. This proves that bounded starter export, not all Mintlify sites. See **Migrate from Mintlify**.

## Maintenance evidence and boundary

Maintenance tests exercise structural OpenAPI changes, stale-example detection, edit-scope guards, local assertion commands, and draft-PR publishing against a local test remote.

The real-library case adopts Zod's bundled v4 compatibility export instead of v3 in `zod@3.25.76`: `.errors` is absent while `.issues` remains. The actual agent corrected a stale JavaScript example, updated onboarding, and added source-grounded migration notes. Independent verification executed the exact reviewed example against `zod/v4`, checked the allowed diff, built the site, and produced a rendered local preview and reviewable patch/PR body. Compact evidence is retained under `docs/evidence/` in the private repository. This is a real API-family change within the pinned package, not an invented package release or a production customer case study.

Reproduce with `npm run test:maintenance:real` in the template checkout. It requires your authenticated agent and may consume quota. No GitHub PR is opened and no preview is published during the private-release hold. The remote draft-publishing path is covered separately against a local test remote; a live GitHub case remains a release-readiness check.

User-defined `maintenance.exampleChecks` can execute selected offline/local examples, and static CI runs attach rendered review artifacts. Neither a successful build nor an agent's statement proves all examples are correct. This case executes one explicitly reviewed example, not every imported example or language client.
