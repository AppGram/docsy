# Contributing to Docsy

Thanks for helping improve Docsy.

## Development

```bash
npm ci
npm run dev
```

The included `docsy.config.yaml` uses a committed public OpenAPI example. Open `http://localhost:4321/docs/` after the development server starts.

## Before a pull request

```bash
npm run validate
npm run build
```

Keep changes inside these boundaries:

- YAML owns product configuration, navigation, ingestion, theme tokens, and access rules.
- Astro and CSS own interface behavior and presentation.
- Adapters normalize external documentation formats before rendering.
- Protected documentation must be enforced on the server and must not be copied into `public/`.

Do not introduce an external font service or typographic tracking.

## Pull requests

Describe the behavior being changed, include screenshots for visible changes, and mention whether you tested both open and locked access modes.

## Contribution terms

Docsy is source-available under the [Elastic License 2.0](LICENSE). By submitting a contribution, you confirm that you have the right to submit it and agree that it will be distributed under ELv2 with the rest of Docsy. Your submission must not include code under terms that conflict with ELv2.
