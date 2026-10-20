# npm release checklist

`@appgram/docsy@0.4.0` is a prepared release candidate, not an already published package. Repository visibility, Pages deployment and npm publication are separate. The release workflow does not create Git tags or GitHub releases.

## Verify locally without publishing

```bash
npm ci
npm test
npm run build
npm run test:package
```

The last command audits and packs the actual npm tarball, installs it with real registry dependencies into a new directory, invokes its npm bin, generates a new source-owned site with user-supplied OpenAPI and MDX, validates and builds it, and starts actual static and standalone servers. It tests anonymous/authorized retrieval and checks that a generated site can create another site without the original checkout. No `node_modules` symlink back to the checkout is used. A successful scratch project is cleaned up; failed scratch projects are retained for debugging.

The archive, SHA-256 manifest, test report and command logs are under `.docsy/packages/release/`. The archive audit rejects missing template files, `.env`/`.npmrc` files, credential filenames, dependencies, generated build output and launch videos. Review the file list and source for secrets too: a filename audit is not a complete content-based secret scanner.

## Run verification in GitHub Actions

Open **Actions → Prepare or publish npm package → Run workflow**, select **main**, and leave **publish unchecked**. The workflow runs the unit tests and portal build, then the same installed-package test. It uploads only the tested `.tgz`, `package-manifest.json` and `package-test.json` as `npm-release-COMMIT_SHA`. Verification has read-only repository permissions and no npm credentials or OIDC publishing permission.

Verification does not log in to npm, publish a package, change dist-tags, create a GitHub release/tag or enable the publishing gate. PR/main CI also runs the installed-package test as a required member of the combined PR checks job.

## Owner setup before the first npm publication

1. Verify ownership of the **npm** `@appgram` scope and permission to publish `@appgram/docsy`. The GitHub organization does not grant npm organization ownership. An HTTP 404 from the public registry does not prove ownership or that a private/reserved name is available.
2. Configure npm account security/2FA. Complete any initial package registration/bootstrap required by npm; do not assume GitHub authentication is npm authentication. That step is a separate explicit publication decision, not part of verification.
3. In npm package settings, configure a **GitHub Actions trusted publisher** for organization **AppGram**, repository **docsy**, workflow filename **release-npm.yml**, environment **npm-release**. Match spelling/case exactly. The workflow uses npm 11.9.0 with Node 22.22.0, satisfying npm's documented OIDC minimums. No persistent `NPM_TOKEN` is needed or accepted by the workflow. Create the trusted-publisher connection when ready to publish; npm currently expires a new, unused connection after two days.
4. In GitHub, protect the **npm-release** environment with required maintainer review and main-only deployment rules before enabling publishing. The environment name alone is not an approval policy; configure those protection rules explicitly.
5. Only after that setup and an explicit release decision, set the repository Actions variable **DOCSY_ENABLE_NPM_PUBLISH=true**. Leave it unset/false during preparation. This is independent of **DOCSY_ENABLE_PAGES**.

See npm's primary documentation for [trusted publishing](https://docs.npmjs.com/trusted-publishers/) and [scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/). OIDC verification cannot be proven with `npm whoami` or a dry run; actual publication remains untested until an authorized release happens.

## Publish deliberately

Before a release, update package and lockfile versions together, write release notes, and review the exact main commit. Existing npm versions are immutable; do not reuse a version after it has been published.

Dispatch **release-npm.yml** on **main**, select **publish**, and enter **@appgram/docsy@0.4.0** as the confirmation for this candidate. Choose **latest** for a stable version; use **next** or **beta** for a prerelease. The guard rejects prereleases using latest. Approve the protected environment after reviewing the new verification artifact.

The publish job re-checks the repository, branch, event, enable gate, confirmation, package version, test result, source commit and tarball SHA-256. It downloads and publishes the exact tested archive, rather than repacking the checkout, with public access and provenance via OIDC. Only that job has `id-token: write`; it never runs for a main push, pull request, verification-only run or failed verification.

The root `prepublishOnly` hook also rejects an unconfirmed folder publication. It is an accidental-publication safeguard, not an access-control boundary: a maintainer can bypass npm lifecycle scripts, so npm permissions and workflow/environment protection remain essential.

After an authorized first release, verify the npm listing and create a fresh site from the registry:

```bash
npm exec --package @appgram/docsy@0.4.0 -- create-docsy my-docs --yes --ci
```

Update the README's candidate/unpublished status only after the registry publication succeeds. Do not claim a local tarball, workflow artifact or successful dry run proves the npm release is live.
