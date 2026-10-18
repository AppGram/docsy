Docsy exposes the same authored guides, API reference, and SDK content to people and software. Browser search and the JSON query API share an index and ranking implementation.

## Full-text search

Search includes article paragraphs, code examples, rich-component content, API parameters, and SDK symbol content. Matches in titles rank ahead of body matches. Multiple query terms must all occur in the indexed section; accent differences are normalized.

```yaml
search:
  enabled: true
  maxResults: 30
```

Article results link to the matching section and show a text excerpt. Search follows the reader's selected version and locale. Locked sites filter the index by documentation permissions before returning it. Search is local text retrieval, not semantic or generative AI search.

Queries match words, with prefix completion on the final term. Translated-context fallback records identify their actual `contentLocale` and `isFallback` status, so an agent can distinguish the requested locale from the language of the returned article.

## Static JSON and Markdown exports

These work on GitHub Pages and other static hosts:

| Resource | Purpose |
| --- | --- |
| `/agent/index.json` | Versioned full-text records and retrieval links |
| `/agent/pages/guides/getting-started.json` | A page's title, canonical URL, context, and Markdown |
| `/format-md/guides/getting-started` | The same page as clean Markdown |
| `/llms.txt` | Discover documentation and machine-readable links |
| `/llms-full.txt` | Combined readable documentation |

Add `site.basePath` before each path. For this portal the prefix is `/docsy`. The overview document uses the key `index`, such as `/agent/pages/index.json`.

Non-default contexts include their route prefix in the document key: `/agent/pages/versions/v1/fr/guides/getting-started.json`.

```yaml
agent:
  enabled: true
  query: false
  maxResults: 10
  maxQueryLength: 500
```

An agent on static hosting downloads the index, performs local retrieval, and follows each record's `jsonUrl` or `markdownUrl`. Static hosts cannot execute a `q` parameter. The query endpoint explicitly reports this limitation rather than returning pretend query results.

## Enable a live JSON query endpoint

```yaml
agent:
  enabled: true
  query: true
  maxResults: 10
  maxQueryLength: 500
```

`agent.query: true` switches the build to the standalone Node server, even when documentation access is open. Deploy with Node or Docker, not GitHub Pages. Use Node 22.22 or newer.

```bash
curl 'https://docs.example.com/docs/agent/query.json?q=authentication&version=current&locale=en&type=page&limit=5'
```

`q` is required. `version` and `locale` default to the configured defaults. `type` can be `page`, `api`, or `sdk`; omit it to search all three. `limit` must be between one and `agent.maxResults`.

```json
{
  "schemaVersion": 1,
  "query": "authentication",
  "version": "current",
  "locale": "en",
  "count": 1,
  "results": [
    {
      "title": "Authentication",
      "url": "https://docs.example.com/docs/guides/getting-started#authentication",
      "jsonUrl": "https://docs.example.com/docs/agent/pages/guides/getting-started.json",
      "markdownUrl": "https://docs.example.com/docs/format-md/guides/getting-started",
      "excerpt": "Configure the authentication scheme required by your API…",
      "score": 58,
      "version": "current",
      "locale": "en",
      "type": "page"
    }
  ]
}
```

This is retrieval, not an LLM answer: it does not need a provider key, make external AI calls, execute examples, or accept file paths to read. Your agent can cite the returned URLs and fetch the matching JSON or Markdown document. Invalid parameters return 400. The runtime endpoint limits callers to 60 valid queries per minute per server-observed client address; deployments behind proxies should also enforce limits at their trusted edge.

## Permissions and content negotiation

Locked sites apply the existing documentation rules to JSON documents, Markdown exports, search results, and combined discovery files. Private responses are not shared-cacheable. Variant URLs inherit canonical page rules, so `/guides/private` remains protected in every version and locale.

When running the Node server, a known documentation URL also supports `Accept: text/markdown`. Static deployments use the explicit export paths instead. Credentials and tier identities still come from your trusted proxy or configured authorization webhook.
