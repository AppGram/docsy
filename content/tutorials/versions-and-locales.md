Docsy can publish multiple documentation versions and languages from one repository. The default version/language retains existing URLs; non-default combinations use `/versions/{version}/{locale}` after `site.basePath`.

## Configure versions and languages

```yaml
versions:
  default: current
  items:
    - id: current
      label: Current
    - id: v1
      label: Version 1
      status: deprecated

localization:
  defaultLocale: en
  fallback: true
  locales:
    - code: en
      label: English
    - code: fr
      label: Français
    - code: ar
      label: العربية
      dir: rtl
  messages:
    fr:
      guides: Guides
      version: Version
      language: Langue
      searchLabel: Rechercher
      searchPlaceholder: Rechercher dans la documentation
      onThisPage: Sur cette page
      previous: Précédent
      next: Suivant
      fallback: Cette page est disponible dans la langue par défaut.
```

The version and language selectors appear when more than one option is configured. Switching keeps the current page where it exists; otherwise it opens that context's overview. `status` accepts `current`, `beta`, or `deprecated`; non-current statuses display a notice. `dir: rtl` sets the document direction for right-to-left locales.

## Register article variants

```yaml
content:
  articles:
    - slug: getting-started
      source: content/en/getting-started.md
      title: Getting started
    - slug: getting-started
      locale: fr
      source: content/fr/getting-started.md
      title: Bien démarrer
    - slug: getting-started
      version: v1
      locale: en
      source: content/v1/en/getting-started.md
      title: Getting started with version 1
    - slug: getting-started
      version: v1
      locale: fr
      source: content/v1/fr/getting-started.md
      title: Bien démarrer avec la version 1
```

Omitting `version` makes an article shared across versions. Omitting `locale` means the default locale. Registrations must have unique slug/version/locale combinations.

For each slug, Docsy first selects version-specific registrations, or shared registrations when none exist for that version. It then selects the requested locale, or the default-locale registration when `fallback: true`. It never substitutes a different version's specific article. Fallback content displays a notice; `fallback: false` omits missing translations and removes their sidebar links.

With `site.basePath: /docs`, the example produces:

| Context | URL |
| --- | --- |
| Current / English | `/docs/guides/getting-started` |
| Current / French | `/docs/versions/current/fr/guides/getting-started` |
| Version 1 / English | `/docs/versions/v1/en/guides/getting-started` |
| Version 1 / French | `/docs/versions/v1/fr/guides/getting-started` |

## Translate navigation and overview copy

```yaml
navigation:
  - title: Guides
    titles:
      fr: Guides
    items:
      - title: Getting started
        titles:
          fr: Bien démarrer
        href: /guides/getting-started

home:
  translations:
    fr:
      title: Documentation pour les humains et les agents
      description: Guides et références de votre produit.
      eyebrow: DOCUMENTATION
```

Article titles/descriptions come from their locale registration. UI messages fall back to English when not supplied. The translation keys are listed in `src/lib/messages.ts`; original header copy can be overridden with `searchLabel`, `searchPlaceholder`, and `llmLabel` message keys. Translation is authored by your team or coding agent; Docsy does not send content to a translation service.

## Version API and SDK sources

```yaml
ingestion:
  openapi:
    source: sources/current-api.yaml
    versions:
      v1: sources/v1-api.yaml
```

SDK entries support the same `versions` map for their metadata source. Versions without an override use the main source. API sections and SDK metadata are shared across locales unless their upstream content already supplies translated prose.

Search, Markdown, discovery files, JSON documents, and runtime queries use the selected context. Permission rules on canonical paths apply to all contexts; more specific variant rules can be placed earlier in the ordered rule list.
