Docsy can turn a committed API or code change into a draft documentation pull request. It compares source revisions, identifies likely affected articles and examples, asks a coding agent to update them, and validates the resulting site before opening the PR.

## Enable the workflow

New Docsy projects include `.github/workflows/docsy-maintenance.yml` and the maintenance CLI. The workflow is disabled in YAML until you enable it:

```yaml
maintenance:
  enabled: true
  watch:
    - sources/**
    - src/**
  docs:
    - content/**/*.md
    - README.md
  breakingChangesFile: content/maintenance/breaking-changes.md
```

`watch` selects source paths whose committed changes should trigger a review. `docs` limits the Markdown files the agent can edit. Both accept relative paths with `*`, `**`, and `?` wildcards. Use `ignore` to exclude generated or unrelated input paths.

The source code and documentation must be available in the checked-out repository. For an application monorepo, include the application paths under `watch`. For a separate docs repository, commit the relevant OpenAPI or SDK snapshots into `sources/`.

In GitHub repository settings:

1. Add an Actions secret named `OPENAI_API_KEY` for the Codex GitHub Action.
2. Under **Actions → General → Workflow permissions**, enable **Allow GitHub Actions to create and approve pull requests**. The workflow creates drafts; it never approves or merges them.
3. Push a source change to the default branch, or run **Maintain documentation** manually with a comparison base ref.

If GitHub disables the pull-request setting for a repository, an organization owner must first allow it under the organization's **Settings → Actions → General** policy.

The workflow skips source comparisons that find no watched changes. If the API secret is missing, it reports the setup step instead of calling the agent.

## What happens after a source change

### Detect documentation impact

The planner compares the Git revisions and records changed source paths. For local OpenAPI JSON or YAML, it compares operations, inherited parameters, local schema references, request and response contracts, authentication, and server URLs. Swagger 2 inputs are supported too.

Removed endpoints and newly required parameters are marked as breaking changes. Contract changes that need interpretation are marked for review. Descriptions and reference metadata are kept separate from those findings.

The planner searches Markdown for endpoint paths, operation identifiers, changed code symbols, and source references. It flags examples that still call removed endpoints or may omit a newly required parameter. The agent inspects the source and relevant articles beyond that initial list.

### Update articles and explain migrations

The agent receives the source diff, impact report, and project instructions. It updates guides and examples from source evidence and records unresolved questions for the reviewer.

When changes break existing usage, it can add migration notes at `breakingChangesFile` and register that page in the YAML article list and navigation. Generated API and SDK reference content is rebuilt from the configured ingestion inputs.

The allowed changes are Markdown under `docs`, the breaking-changes article, and the YAML fields for article registration, navigation, and OpenAPI section mappings. Branding, theme, access policy, runtime source, dependencies, and workflows stay outside that edit scope.

### Validate and open a draft PR

A fresh GitHub job applies the proposed patch, checks its file scope and protected YAML settings, and runs:

```bash
npm run validate
npm run build
```

Only a successful update reaches the publishing job. That job opens a draft on a `codex/docs-maintenance-...` branch with a description of the source changes, documentation edits, breaking-change findings, corrected examples, validation, and unresolved questions. Repeated runs for the same source commit reuse an existing PR.

Review the actual behavior, examples, and rendered pages before merging. Validation checks configuration, types, and the site build; it does not prove that every example works against a running API.

## Execute selected examples and inspect the preview

Add trusted, local assertion commands to YAML when specific examples must actually run:

```yaml
maintenance:
  enabled: true
  exampleChecks:
    - name: API examples against a local fixture server
      command: [node, tests/documented-requests.mjs]
      timeoutMs: 30000
```

Commands are explicit argument arrays, not shell strings. They run after scope/configuration validation and before the production build, with a timeout; a failed check stops the update. Use offline assertions or local mock servers. Do not put production credentials in these commands. The agent cannot edit this configuration, executable test files, or dependency scripts in a maintenance update. Running a configured check is executing trusted project code, so review it like any CI test.

The PR body lists exactly which checks ran. With no checks configured, it explicitly says runtime correctness is unproven. Even a passing test suite covers only the assertions you wrote, not every language/client or example.

For open static sites, CI attaches **docsy-static-preview**, a seven-day Actions artifact containing the validated rendered `dist/` site. The PR body links to its workflow run. It is a download for review, not a public preview deployment; serve it at the configured base path locally. Protected/server builds do **not** upload their bundle as a static preview. Review those behind your actual trusted authentication integration using Node/Bun.

Local runs write `.docsy/maintenance/preview.json`, the validated patch, and `pr-body.md`. Run `npm run preview` in that checkout to inspect the result. Draft creation still requires `--pr` locally, and no workflow auto-approves or merges changes.

## Inspect impact locally

Run a report without invoking a model or opening a PR:

```bash
npm run maintain -- plan --base HEAD~1
```

The planner writes `.docsy/maintenance/report.json` and `prompt.md`. These local artifacts are ignored by Git. You can use the report and prompt with another coding agent as well.

`--base` is required. Use `--head <ref>` to inspect a particular committed revision. Comparisons use committed files, so commit the source change before running a maintenance task.

## Run the agent locally

With an authenticated Codex CLI and a clean checkout:

```bash
npm run maintain -- run --base HEAD~1
```

The agent updates the working tree, then Docsy checks the scope and validates the production build. The changes remain available as a local diff for review. Add `--pr` when you want Docsy to create a branch, commit, push, and open a draft using your authenticated GitHub CLI:

```bash
npm run maintain -- run --base HEAD~1 --pr --target-branch main
```

Leave `maintenance.model` unset to use the agent's configured default, or set it to a model available to your account. The local CLI uses your existing Codex sign-in; GitHub Actions uses the repository's API secret.

## Source and review boundaries

Authorship and per-page edit metadata are protected. The agent may register or correct an article's ordinary route/title/source metadata, but cannot assign authors, contributors or reviewers, change publication/update/review dates, add agent provenance, or redirect the edit button. These are maintainer-supplied records, not claims that an automatic build may invent. See [Authors, reviews and edit links](../authors-and-edit-links).

This workflow reacts to Git changes in the default branch. Remote OpenAPI and SDK URLs are still valid ingestion sources, but the maintenance planner does not poll them for upstream changes. Commit snapshots when you need reproducible version comparisons; a source-sync job can update those snapshots and trigger the same loop.

SDK and application changes are reviewed from their Git diff and documentation references. Structural breaking-change classification currently applies to OpenAPI and Swagger; the agent interprets SDK and application semantics from the available code.

The workflow uses the [official Codex GitHub Action](https://learn.chatgpt.com/docs/github-action) with repository read permissions during generation. Validation and PR publishing run in separate jobs; the publisher receives the GitHub write permissions needed for the draft.
