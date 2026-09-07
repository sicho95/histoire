# Bibliothèque éditoriale

Chaque histoire publiée possède son fichier JSON au format `schemaVersion: 2`. Le fichier `catalog.json` est la liste officielle téléchargée par la PWA.

Pour publier une histoire :

1. valider les JSON avec `npm run validate:stories` ;
2. augmenter la `revision` de l'histoire ;
3. reporter la même révision dans `catalog.json` ;
4. ajouter éventuellement ses pistes dans `audio/manifest.json` ;
5. pousser sur `main` : le workflow produit la branche statique `WebApp`.

Les brouillons inventés par les enfants ne sont jamais publiés automatiquement. Ils sont exportés depuis l'application dans un dossier de révision parentale, puis relus avant d'entrer dans ce catalogue.
