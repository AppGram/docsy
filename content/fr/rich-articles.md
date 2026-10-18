Les composants Docsy s’écrivent directement en Markdown. Les réglages restent dans YAML ; le contenu reste lisible dans votre dépôt et dans les exports pour les agents. Aucun service de rédaction ni police distante n’est nécessaire.

## Encadrés

:::note[La configuration appartient à YAML]
Gardez l’identité du produit, la navigation, les sources et les permissions dans `docsy.config.yaml`. Rédigez les explications ici, en Markdown.
:::

:::tip[Validez avant de publier]
Exécutez `npm run validate` pour détecter les liens cassés, les composants invalides et les erreurs d’importation avant la publication.
:::

:::warning[Gardez vos secrets hors du dépôt]
Lisez les identifiants privés depuis l’environnement du serveur. Ne les ajoutez jamais au YAML ni aux exemples publiés.
:::

:::danger[Un site statique ne protège pas les articles]
Utilisez le serveur Node pour les pages verrouillées. Un contrôle effectué uniquement dans le navigateur ne peut pas protéger un fichier public.
:::

Chaque type possède une icône et un accent discret. Le titre explique la situation ; le corps indique quoi faire. La distinction ne repose pas uniquement sur la couleur.

```md
:::warning[Gardez vos secrets hors du dépôt]
Lisez les identifiants privés depuis l’environnement du serveur.
:::
```

## Étapes numérotées

:::steps
1. **Générez un projet.** Partez de l’interface modifiable de Docsy.

2. **Configurez les sources.** Déclarez les articles, la spécification API et les métadonnées SDK dans YAML.

3. **Validez et publiez.** Vérifiez le résultat avant de le déployer.
:::

Placez une liste Markdown ordonnée entre `:::steps` et `:::`. Les paragraphes et les blocs de code peuvent faire partie d’une étape.

## Onglets synchronisés

Les groupes utilisant la même clé `sync` mémorisent le même libellé dans le stockage local du navigateur.

::::tabs{sync="package-manager"}
:::tab[npm]
```bash
npm run validate
npm run build
```
:::
:::tab[pnpm]
```bash
pnpm validate
pnpm build
```
:::
::::

Utilisez quatre deux-points pour le groupe `tabs` et trois pour chaque enfant `tab`. Le clavier permet de naviguer avec les flèches, Début et Fin. Sans JavaScript, tous les panneaux restent visibles.

## Groupes de code

Entourez les blocs de code avec `:::code-group`. Le texte placé après la langue du bloc devient le libellé de l’onglet.

:::code-group
```javascript JavaScript
console.log('Une documentation qui vous appartient.');
```
```python Python
print('Une documentation qui vous appartient.')
```
:::

## Explications repliables

:::accordion[Que se passe-t-il sans JavaScript ?]
Les onglets restent lisibles et les sections repliables utilisent l’élément natif `details` du navigateur. La recherche indexe tous les panneaux, pas uniquement celui qui est sélectionné.
:::

## Extraits réutilisables

Déclarez les fichiers Markdown dans YAML :

```yaml
content:
  snippets:
    publicationFr: content/snippets/publishing-checklist.fr.md
```

Insérez ensuite `::include{src="publicationFr"}` sur sa propre ligne :

::include{src="publicationFr"}

Les extraits sont développés dans les articles, la recherche, les exports Markdown et les documents JSON. Les noms inconnus, les cycles, les chemins hors du projet et plus de dix inclusions imbriquées font échouer la validation.

## Choisir les composants autorisés

```yaml
content:
  components: [note, tip, warning, danger, steps, tabs, accordion, code-group, include]
```

Un composant inconnu, désactivé ou mal structuré empêche la publication. Le composant `tab` doit toujours être un enfant de `tabs`.
