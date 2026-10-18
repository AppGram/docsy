# Security policy

Please do not report security vulnerabilities in a public issue.

Use GitHub's private vulnerability reporting for this repository. Include reproduction steps, affected configurations, and the impact you observed.

## Lock-mode deployment boundary

The trusted-header provider assumes Docsy runs behind an authentication proxy that removes client-supplied identity headers before adding verified values. The Docsy origin must not be reachable around that proxy.

Keep protected OpenAPI and SDK source files outside `public/`. Files under `public/` are served directly and are not protected by middleware.

## Documentation maintenance

The maintenance workflow runs on the default branch and explicit workflow dispatch. The generation job has repository read permissions and uses the official Codex Action's API proxy and `drop-sudo` strategy. Repository diffs are treated as task evidence.

Validation runs in a fresh checkout with no OpenAI secret, restricts edits to configured Markdown paths and article/navigation/OpenAPI-section YAML, and rejects changes to access policy, scripts, dependencies, workflows, and other runtime configuration. PR publishing is a separate job with GitHub write permissions and opens drafts for human review.

Only enable the workflow for repositories and ingestion sources you trust. Do not put API keys in YAML, documentation examples, or tracked source snapshots.
