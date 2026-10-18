Lock mode protects authored articles, generated API pages, SDK reference pages, Markdown exports, and search results with the same ordered permission rules.

Docsy performs authorization. Your identity provider or application remains responsible for authentication.

## Define tiers and rules

Start with the most specific rule because the first matching rule wins:

```yaml
access:
  mode: locked
  provider:
    type: header
    tierHeader: x-docsy-tiers
    userHeader: x-docsy-user
  tiers:
    developer:
      label: Developer
      description: Public integration documentation.
    enterprise:
      label: Enterprise
      description: Restricted administration and security documentation.
  rules:
    - pattern: /guides/internal/**
      tiers: [enterprise]
    - pattern: /api/license-keys
      tiers: [enterprise]
    - pattern: /api/**
      tiers: [developer, enterprise]
  gate:
    title: This documentation is locked.
    description: Sign in with an account that can access this page.
    loginUrl: https://app.example.com/login
    loginLabel: Sign in to continue
```

`*` matches one path segment. `**` matches any number of segments. A route with no matching rule remains public, even in locked mode.

## Use trusted headers

The header provider is intended for Cloudflare Access, oauth2-proxy, an ingress gateway, or your own authentication proxy. The proxy must:

1. Remove client-supplied identity headers.
2. Authenticate the visitor.
3. Set the trusted tier and optional user headers.
4. Prevent direct access around the proxy.

Tier values can be comma- or space-separated. A trusted request might contain:

```http
x-docsy-user: user_123
x-docsy-tiers: developer,enterprise
```

Never expose a header-provider deployment directly to the internet. Otherwise a visitor could send the trusted headers themselves.

## Ask your application with a webhook

Use a webhook when your application owns the authorization decision:

```yaml
access:
  mode: locked
  provider:
    type: webhook
    endpoint: https://app.example.com/internal/docsy/authorize
    method: POST
    forwardHeaders: [cookie, authorization]
    pathHeader: x-docsy-path
    timeoutMs: 3000
```

The endpoint returns an identity:

```json
{
  "authenticated": true,
  "subject": "user_123",
  "tiers": ["enterprise"]
}
```

Timeouts, errors, invalid payloads, and non-2xx responses fail closed for protected routes.

## Build and deploy locked mode

Locked mode changes Astro from a static build to a standalone server because authorization runs for every request. It can run on Node or on the tested Bun production runtime:

```bash
npm run build
HOST=0.0.0.0 PORT=8080 npm run preview
```

To use Bun after the same Node build, start with `npm run start:bun` instead of `npm run preview`. Bun 1.3.5 or newer is supported as the production runtime; Node remains the build toolchain.

Rebuild after changing access mode, rules, article sources, or ingestion configuration. Put the server process behind the trusted proxy or connect it to the webhook provider before exposing it publicly.
