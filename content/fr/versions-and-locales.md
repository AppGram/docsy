Ce portail propose deux versions (**Current** et **Preview (demo)**) et trois langues (**English**, **Français** et **Español**). Les sélecteurs au-dessus de l’article changent de contexte en conservant la page lorsque celle-ci existe.

:::note[Une démonstration, pas une nouvelle version du produit]
La version Preview contient un guide de démarrage différent pour vérifier les variantes. Les autres articles sont partagés entre les versions. Elle n’annonce aucune fonctionnalité future.
:::

## Tester les quatre combinaisons

1. Ouvrez **Bien démarrer** en version Current et en français.
2. Choisissez **Preview (demo)** : le titre et le corps du guide changent.
3. Choisissez **English** : la version Preview reste sélectionnée, mais le guide devient anglais.
4. Revenez à **Current** : vous retrouvez le guide actuel.

| Contexte | Chemin |
| --- | --- |
| Current / English | `/docsy/guides/getting-started` |
| Current / Français | `/docsy/versions/current/fr/guides/getting-started` |
| Preview / English | `/docsy/versions/preview/en/guides/getting-started` |
| Preview / Français | `/docsy/versions/preview/fr/guides/getting-started` |

## Déclarer les versions et les langues

```yaml
versions:
  default: current
  items:
    - id: current
      label: Current
    - id: preview
      label: Preview (demo)
      status: beta
localization:
  defaultLocale: en
  fallback: true
  locales:
    - code: en
      label: English
    - code: fr
      label: Français
```

La combinaison par défaut conserve les URL habituelles. Les autres utilisent `/versions/{version}/{locale}` après le chemin de base du site. Une langue peut aussi déclarer `dir: rtl` pour une écriture de droite à gauche.

## Enregistrer les variantes d’un article

```yaml
content:
  articles:
    - slug: getting-started
      source: content/getting-started.md
      title: Get started with Docsy
    - slug: getting-started
      locale: fr
      source: content/fr/getting-started.md
      title: Bien démarrer avec Docsy
    - slug: getting-started
      version: preview
      locale: fr
      source: content/preview/fr/getting-started.md
      title: Bien démarrer — espace de démonstration
```

Sans `version`, un article est partagé entre les versions. Sans `locale`, il appartient à la langue par défaut. Pour un même article, les variantes propres à une version sont sélectionnées avant les variantes partagées ; Docsy cherche ensuite la langue demandée, puis la langue par défaut si le repli est activé.

## Vérifier le repli en anglais

En français, ouvrez **Configuration YAML** ou **Recherche et API pour les agents**. Ces articles n’ont pas encore de traduction. Le corps reste en anglais et un message indique le repli. La navigation et la recherche gardent le contexte français.

Avec `fallback: false`, les articles sans traduction disparaissent de cette langue au lieu d’afficher le texte anglais.

## Traduire la navigation et les exports

Les libellés de navigation utilisent `titles.fr`, l’accueil utilise `home.translations.fr`, et les textes de l’interface utilisent `localization.messages.fr`. La traduction est locale et rédigée dans le dépôt ; Docsy n’envoie pas vos articles à un service de traduction.

Les exports Markdown et JSON correspondent à la version et à la langue choisies. Pour un article de repli, `contentLocale` indique `en` et `isFallback` vaut `true`. La recherche inclut uniquement les enregistrements du contexte sélectionné.
