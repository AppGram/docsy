Docsy validates content before serving a production build, not only TypeScript and YAML shapes.

## Run the checks

```bash
npm run validate
npm run build
```

Both commands load registered articles, expand snippets, render rich components, load SDK inputs, and check configured API sources. They verify every configured version and locale. `build` then creates the production output.

## What fails validation

- Unreadable or malformed configured sources.
- OpenAPI structural errors and unresolved references, including external reference files.
- API examples that do not conform to their declared schemas.
- Unknown, disabled, or malformed article components and invalid snippet includes.
- Missing internal documentation routes, heading anchors, and referenced local assets.
- Duplicate article variants or unknown version/locale registrations.

API input is checked and bundled with Redocly's OpenAPI engine. Generated request examples use the declared security scheme, inherited parameters, and required query/header inputs rather than assuming Bearer authentication.

Schema validation checks examples supplied in the API specification. When a schema has no explicit example, generated values are illustrative placeholders, not proof of a business-valid request; review them against your API's constraints and integration tests.

## Configure validation

```yaml
validation:
  links: true
  api: true
```

Both default to true. Disable a check only deliberately: `links: false` skips internal-link validation; `api: false` skips strict API linting, but source loading and reference bundling still fail on errors. An unavailable configured API or SDK source does not silently disappear from the portal.

Links outside the configured documentation mount and external websites are not fetched. Validation does not run code samples, make live API requests, verify credentials, or guarantee the factual accuracy of prose. Contract/example checks are offline checks of the configured specification. Keep a human review step and your existing integration tests.

## Review before publishing

::include{src="publishing"}
