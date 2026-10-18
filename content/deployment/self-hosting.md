Docsy supports two deployment shapes. Use Node 22.22 or newer. Choose open mode with `agent.query: false` for public static documentation. Locked mode or `agent.query: true` uses the standalone Node server.

## Deploy an open static build

Configure open mode and the public URL:

```yaml
site:
  origin: https://docs.example.com
  basePath: /

access:
  mode: open
agent:
  query: false
```

Build the project:

```bash
npm ci
npm run build
```

Astro writes the static site to `dist/`. Docsy also stages a host-neutral copy under `release/`, including the mount-path directory when `site.basePath` is not `/`.

Upload `dist/` when the hosting platform already mounts the project at the configured base path, as GitHub Pages does. Upload `release/` when the server expects the mount-path directory to exist inside the document root.

## Run locked mode

Locked mode needs the standalone Node server. Public sites can also use this runtime by setting `agent.query: true` to enable live JSON retrieval:

```yaml
access:
  mode: locked
  provider:
    type: header
    tierHeader: x-docsy-tiers
    userHeader: x-docsy-user
```

Build and start it:

```bash
npm ci
npm run build
HOST=0.0.0.0 PORT=8080 npm run preview
```

Put the process behind the trusted authentication proxy described in the lock-mode guide. Do not expose a header-provider deployment directly to the internet.

## Use Docker Compose

The repository includes a multi-stage Dockerfile and Compose service:

```bash
docker compose up --build
```

The container builds the configured site and starts the correct production shape. It works for the static preview server and for the standalone locked-mode server.

## Supply environment-specific configuration

Use environment placeholders for values that change by deployment:

```yaml
site:
  origin: ${DOCSY_ORIGIN:-http://localhost:4321}
```

Select a completely different YAML file with `DOCSY_CONFIG`:

```bash
DOCSY_CONFIG=docsy.enterprise.yaml npm run build
```

Rebuild after changing configuration, Markdown, OpenAPI, or SDK sources. These inputs are compiled into the output.

## Health and exposure checklist

- `npm run validate` and `npm run build` succeed in CI.
- `site.origin` and `site.basePath` match the public URL.
- Only `public/` assets are directly exposed as static source files.
- Protected inputs remain outside `public/`.
- Locked mode cannot be reached around the trusted proxy.
- The proxy removes visitor-supplied identity headers before setting its own.
- Search results and Markdown exports are tested for both authorized and unauthorized visitors.

