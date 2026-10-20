Docsy keeps article attribution in `docsy.config.yaml`, for both Markdown and MDX. Profiles are reusable; each version/language registration decides who wrote, contributed to or reviewed that particular text.

## Register author profiles

```yaml
authors:
  alex:
    name: Alex Morgan
    kind: human
    github: your-github-username
    role: Documentation maintainer
    avatar: assets/authors/alex.png
  platform-team:
    name: Platform team
    kind: organization
    url: https://example.com/team
  docs-agent:
    name: Your coding agent
    kind: agent
    provider: Your agent provider
```

These names and IDs are examples, not claims about this project's contributors. Omit fields you do not need. `kind` defaults to `human`; the other choices are `organization` and `agent`. `github` is a username or organization name, not a repository URL. An explicit HTTP(S) `url` overrides the derived GitHub profile link. `role` appears as a profile tooltip.

Avatars are optional for human, team and coding-agent profiles. Local `assets/...` paths follow `site.basePath`; place the file in `public/assets/`. No avatar is fetched from GitHub automatically. Remote HTTP(S) avatars are used only when explicitly configured, and will contact that external host. Never place private images in `public/`.

## Configure profile pictures and unknown authors

Profiles with `kind: organization` appear as compact logo-and-name tags beside the other credited profiles. Use a short `name` such as `AppGram` for the tag label and `url: https://appgram.dev` for its link destination; the domain does not need to be the displayed name.

```yaml
authors:
  alex:
    name: Alex Morgan
    avatar: assets/authors/alex.png
  docs-agent:
    name: Your coding agent
    kind: agent
    avatar: assets/authors/docsy-agent.svg
reader:
  defaultAuthorAvatar: assets/authors/unknown.svg
  unknownAuthorAvatar: assets/authors/unknown.svg
```

Each known author's `avatar` takes priority. `reader.defaultAuthorAvatar` is an optional shared picture for registered authors who have no individual image. Without either, Docsy retains initials or a generic coding-agent icon. Images are cropped into the existing circular byline; a failed image falls back to initials or the local icon rather than leaving a broken picture.

The bundled `assets/authors/unknown.svg` is a neutral outlined placeholder rendered with the current theme's text, surface and border colours, not a fixed light or blue background. Custom photos and other image URLs retain their original colours.

`reader.unknownAuthorAvatar` is a separate opt-in: an article with no `authors` displays this image and the label “Unknown author.” This does not create a person in the author registry, structured data, search or Markdown/JSON exports, or infer an author from contributors or agent provenance. Unknown author IDs still fail validation, so a typo cannot silently turn a credited writer into an anonymous one. Omitting `unknownAuthorAvatar` leaves unauthored articles without a writer byline. `reader.showByline: false` hides both known and unknown bylines.

Both fallback settings accept a local asset or an explicit HTTP(S) image URL, just like profile `avatar`. Neither fallback is enabled automatically. Change the unknown label through `localization.messages.<locale>.unknownAuthor`; the bundled portal supplies Spanish and French labels too. These public image URLs are not protected by article access rules.

## Credit an article

```yaml
content:
  articles:
    - slug: authentication
      source: content/authentication.md
      title: Authentication
      authors: [alex]
      contributors: [docs-agent, platform-team]
      reviewedBy: [alex]
      publishedAt: '2026-10-01'
      updatedAt: '2026-10-19'
      reviewedAt: '2026-10-19'
```

Use `authors` for the byline, `contributors` for assistance and `reviewedBy` for a recorded review. All lists are optional and preserve their configured order. Unknown IDs and duplicate IDs in a list fail validation. Leaving the fields out produces no author/date claims. You can credit an agent as the writer, rather than a contributor, by putting its ID in `authors`.

Quote dates as `YYYY-MM-DD`. Invalid calendar dates, an update before publication, or a review date without any reviewer fail validation. Dates are formatted in the reader's UI language using UTC. They are never taken from filesystem modification times or automatically advanced on build.

Attribution on a fallback article comes from the selected source registration, not a guessed translator. To credit a translator, add them to that locale registration's `contributors`. Version-specific authorship does not inherit another version's metadata.

## Add the optional edit button

```yaml
reader:
  showByline: true
  editEnabled: true
  editUrl: https://github.com/OWNER/REPOSITORY/edit/main/{source}
  reportUrl: https://github.com/OWNER/REPOSITORY/issues/new
```

The edit button appears beside the article credits. It opens GitHub's existing edit flow; Docsy does not authenticate to GitHub, grant repository access, commit edits or create a pull request itself. GitHub determines what the reader can do. A private repository still requires the appropriate GitHub access.

`{source}` expands to the selected article's source path, encoding each path segment. `{version}` and `{locale}` are also supported, but are documentation context IDs—not automatically Git branches or directory names. For a branch literally named `main`, keep `main` in the template as above. Paths for translations follow their actual `source` values, including when a locale falls back to another language.

The author profile's `github` setting is independent: writers may have personal profiles while the edit button points to an organization-owned documentation repository. No edit link is inferred from an author, source host or `site.githubUrl`. Generated projects using the CLI's `--repo` option already get explicit edit/report URL templates.

To disable all edit buttons without removing the template:

```yaml
reader:
  editEnabled: false
```

To hide or override a particular page's edit link, set one of these fields on its article registration:

```yaml
# Under the chosen content.articles item:
editUrl: false
# Or, instead:
# editUrl: https://github.com/OWNER/OTHER-REPOSITORY/edit/main/{source}
```

A global `editEnabled: false` always wins. An unset page-specific URL uses `reader.editUrl`; removing both URL settings leaves the button absent. Report links remain independent and include the canonical page URL, version and language, not visitor authentication/search query parameters.

## Record agent provenance without inventing a score

```yaml
# Under the chosen content.articles item:
authors: [alex]
contributors: [docs-agent]
provenance:
  agent: docs-agent
  model: YOUR_ACTUAL_MODEL_ID
  referenceUrl: https://github.com/OWNER/REPOSITORY/pull/123
```

All provenance is optional. `agent` must reference a registered `kind: agent` profile. `model` records the identifier you actually used; Docsy does not guess it. `referenceUrl` can point to a reviewable pull request or agent run. This is a reference to evidence, not an automatic verification of that evidence.

For a fully agent-written page, put the agent in `authors` instead. For assistance, keep the writer in `authors` and use `contributors` or provenance. A configured reviewer is displayed as a reviewer, not as a Docsy-certified approval. Never claim a human review that did not happen.

There is no automatic confidence, accuracy or quality score. Build/link validation cannot establish those properties, and an agent's self-reported confidence is not a useful guarantee. The numeric `score` in the agent search API is search relevance, not documentation quality.

The maintenance workflow preserves existing authors, contributors, reviewers, dates, provenance and per-page edit URLs. The agent cannot add those claims to a newly registered page either. A maintainer records them deliberately after reviewing the change; the workflow does not manufacture approvals or silently advance review dates.

## Visibility, exports and access

`reader.showByline: false` hides author, date and provenance UI; it does not remove configured metadata from Markdown/JSON exports. To stop publishing an identity, remove its article references. Unused profiles are not exposed through a global author directory.

The article JSON endpoint includes structured `authorship` and the resolved optional `editUrl`. Markdown exports include readable author/reviewer/date/provenance lines. Full-text search can find an article by a credited name. These surfaces keep the existing article permission checks: a locked article's identity and provenance must not leak through public search or JSON exports.

Human and organization writers also appear in article structured data. Agents are never labeled as people there; their optional attribution remains explicit in the byline and Markdown/JSON metadata. Profile names are configured project data, not verified legal identities. Imported API/SDK reference pages continue to describe upstream generator content; Docsy does not invent local authors for those pages.

## What to check before publishing

1. Use real profile IDs and only claim dates/reviews you can substantiate.
2. Check the GitHub edit URL against each selected source, version and language.
3. Leave model/run references out when you do not know them.
4. Verify anonymous and authorized search, Markdown and JSON output for restricted articles.
5. Run `npm run validate` and `npm run build`, and inspect both themes.

Per-page edit opt-outs and explicit date overrides are established documentation patterns; [Starlight documents both](https://starlight.astro.build/reference/frontmatter/#editurl). Docsy's configuration above deliberately stays in YAML rather than silently reading article frontmatter or Git history.
