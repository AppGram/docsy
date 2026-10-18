Docsy is documentation built for humans and coding agents. Your team gets a searchable portal with guides, API reference, and SDK documentation. Your coding agent can read the same content as Markdown and work directly with the files that build the site.

## Give an agent documentation to read

For structured retrieval, use the JSON corpus, per-page JSON exports, and optional runtime query endpoint described in the [search and agent API guide](../search-and-agents). `/llms.txt` and `/llms-full.txt` provide discovery and combined Markdown. Static hosts support exports; live queries require the Node or Bun server.

Open an authored article, API section, or SDK page and use the header's **Markdown** menu to view its export. Adding `?format=md` to that page's URL opens a Markdown view in the browser.

For an agent that fetches URLs directly, use the `/format-md/...` endpoint. With a site mounted at `/docs`, an article at `/docs/guides/getting-started` has this export:

```bash
curl https://docs.example.com/docs/format-md/guides/getting-started
```

This Docsy portal uses `/docsy` as its mount path. For its configuration guide, the export path is `/docsy/format-md/guides/tutorials/yaml-configuration`.

Authored article exports include the title, description, and Markdown body. API exports include endpoint descriptions, parameters, request examples, and available response examples. SDK exports include symbols, signatures, and available examples.

An agent can use those exports as context when implementing an integration or answering a documentation question. In locked mode, exports follow the same access rules as their documentation pages; the agent needs access through your configured authentication setup.

## Give an agent a project to maintain

Generate a project with the Docsy CLI, then open its repository with your coding agent. Generated projects include two instruction files:

- `AGENTS.md` describes the configuration boundary, interface conventions, and validation commands.
- `DOCSY_BRIEF.md` records the project name, mount path, ingestion source, and access mode, along with a customization brief.

The agent edits the same files that a developer would:

| Task | Files to work with |
| --- | --- |
| Write guides and tutorials | Markdown under `content/`, registered in `docsy.config.yaml` |
| Configure branding, navigation, or permissions | `docsy.config.yaml` |
| Update API and SDK input | The configured source under `sources/` or its upstream metadata |
| Change layout or interaction | Astro components and CSS under `src/` |

Commit the changes and review them through your existing Git workflow. Your team chooses which coding agent to use and when to publish.

## Ask for a concrete documentation change

Give the agent a source, an outcome, and the behavior it should preserve. For example:

```text
Read AGENTS.md, DOCSY_BRIEF.md, and docsy.config.yaml.
Use sources/openapi.json to write a first-request guide in content/.
Register it under content.articles and add it to the sidebar.
Use the API source for endpoint names, parameters, and examples.
Flag missing authentication or onboarding details for review.
Preserve the existing interface and access rules.
Run npm run validate and npm run build, then summarize the diff.
```

For a visual change, describe the branding and layout you want. The agent can change theme tokens in YAML or edit the Astro interface when the request calls for it.

## Maintain docs after an API change

Enable `maintenance.enabled` in YAML to use the included GitHub workflow. When watched API or code sources change on the default branch, Docsy prepares an impact report and asks the agent to update affected articles, correct examples, and explain migrations. A fresh job validates the patch and production build before a separate job opens a draft PR.

You can also inspect or run the loop locally:

```bash
npm run maintain -- plan --base HEAD~1
npm run maintain -- run --base HEAD~1
```

The **Documentation maintenance** guide covers YAML settings, the GitHub API secret, allowed edit paths, draft PRs, and source comparison boundaries. Docsy regenerates the reference pages from the configured ingestion input during the build.

## Validate and review

The agent can run the same commands as your team:

```bash
npm run validate
npm run build
```

Validation checks the YAML schema and Astro types. The production build loads the configured sources and renders the routes, search data, and Markdown exports. Review factual accuracy, example behavior, and the final appearance alongside those checks.

Use `npm run preview` to inspect the staged result. When it is ready, publish through your chosen deployment workflow.
