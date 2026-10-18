Docsy est un outil de documentation pour les humains et les agents de code. Vos lecteurs consultent des guides et des références API ou SDK dans un portail de documentation. Vos agents peuvent lire le même contenu en Markdown et vous aider à maintenir les articles, la configuration YAML et l’interface Astro.

:::tip[Testez les deux sélecteurs]
Vous consultez la version française du guide actuel. Choisissez **Preview (demo)** pour ouvrir un article différent, puis **English** pour changer de langue sans quitter cette page.
:::

## Lancer ce portail

Utilisez Node 22.22 ou une version plus récente, puis clonez le dépôt :

```bash
git clone https://github.com/AppGram/docsy.git
cd docsy
npm ci
npm run dev
```

Ouvrez `http://localhost:4321/docsy/`. Le contenu des articles, l’interface et la configuration appartiennent à votre dépôt.

## Générer un projet indépendant

La commande suivante crée un projet Astro modifiable avec le guide de démarrage et l’interface par défaut :

```bash
npm run create -- ../acme-docs \
  --name "Acme API" \
  --base /docs
```

Pour ajouter une référence API générée, fournissez aussi votre source OpenAPI :

```bash
npm run create -- ../acme-docs \
  --name "Acme API" \
  --openapi https://api.example.com/openapi.json \
  --api-base https://api.example.com \
  --base /docs
```

## Organiser le contenu

| Emplacement | Rôle |
| --- | --- |
| `docsy.config.yaml` | Identité, navigation, articles, sources, langues, versions et permissions |
| `content/` et `sources/` | Articles Markdown et métadonnées API ou SDK |
| `src/` | Interface Astro et styles que vous pouvez modifier |

Gardez les réglages dans YAML et les explications dans Markdown. Modifiez Astro ou CSS lorsque vous souhaitez changer l’interface elle-même. Votre agent de code peut travailler dans ces mêmes fichiers, avec `AGENTS.md` et `DOCSY_BRIEF.md` comme instructions.

## Valider et publier

```bash
npm run validate
npm run build
```

Le mode ouvert avec `agent.query: false` produit un site statique adapté à GitHub Pages. Le mode verrouillé ou `agent.query: true` nécessite le serveur Node pour vérifier les permissions ou exécuter des recherches à chaque requête.

:::warning[Ne publiez pas vos secrets]
Les exemples et les articles d’un site statique sont publics. Gardez vos jetons privés dans l’environnement du serveur, jamais dans un fichier Markdown ou YAML publié.
:::

## Tester les traductions et le repli

Les pages **Bien démarrer**, **Articles enrichis** et **Versions et langues** ont une traduction française. Ouvrez **Configuration YAML** pour voir le repli vers l’anglais : la navigation reste en français, mais un message précise que le corps de l’article est en anglais.

La recherche respecte la langue et la version sélectionnées. Essayez **encadrés** sur la page des articles enrichis.
