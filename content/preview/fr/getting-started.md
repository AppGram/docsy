:::note[Vous consultez la version de démonstration]
Cet article distinct permet de tester les versions et les langues de Docsy. Il ne représente ni une version publiée ni une promesse de fonctionnalités futures.
:::

## Ce qui change dans cette version

Le guide Current explique comment créer un projet documentaire. Ce guide Preview est un espace de test. Son titre, sa description et son contenu proviennent de `content/preview/fr/getting-started.md`, déclaré avec `version: preview` et `locale: fr` dans YAML.

Le slug commun `getting-started` permet de rester sur la même page lorsque vous changez de version. Les autres guides sont partagés entre les versions tant qu’aucune variante spécifique n’est déclarée.

## Tester le changement de version

:::steps
1. **Choisissez Current.** Vous retrouvez le guide de création d’un projet, en français.

2. **Choisissez Preview (demo).** Vous revenez dans cet espace de test avec le message de démonstration.

3. **Choisissez English.** La version Preview reste sélectionnée et cet article devient anglais.
:::

## Tester le repli linguistique

En français, ouvrez **Configuration YAML**. Ce guide ne possède volontairement pas de traduction française : son texte reste en anglais et un message explique le repli. Les sélecteurs restent sur Preview et Français.

## Tester la recherche et les exports

Recherchez **espace de test**, puis comparez les résultats avec la version Current. La recherche respecte le contexte sélectionné. Le menu Markdown et le lien JSON désignent cette variante, pas le guide Current.

```text
/docsy/agent/pages/versions/preview/fr/guides/getting-started.json
```

:::tip[Les nouveaux projets restent simples]
Ces variantes sont propres au portail Docsy. Le générateur continue de créer un projet avec une seule version et sa langue par défaut.
:::
