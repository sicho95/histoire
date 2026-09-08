# Bibliothèque éditoriale

Chaque histoire publiée possède son fichier JSON au format `schemaVersion: 2`. Le fichier `catalog.json` est la liste officielle téléchargée par la PWA.

Pour publier une histoire :

1. valider les JSON avec `npm run validate:stories` ;
2. augmenter la `revision` de l'histoire ;
3. reporter la même révision dans `catalog.json` ;
4. ajouter éventuellement ses pistes dans `audio/manifest.json` ;
5. pousser sur `main` : le workflow produit la branche statique `WebApp`.

Les brouillons inventés par les enfants ne sont jamais publiés automatiquement. Ils sont exportés depuis l'application dans un ZIP de révision contenant le récit et ses MP3, puis relus avant d'entrer dans ce catalogue. Ce paquet est aussi réimportable dans la PWA pour conserver l’histoire et ses voix hors connexion.

## Histoires signature

Les six récits de lancement sont maintenus dans `content/signature-stories.mjs`. `npm run generate:stories` reconstruit leurs JSON et le catalogue. Le validateur parcourt toutes les routes possibles et vérifie la durée, le nombre de décisions, les trois fins accessibles et l’intervalle maximal de 2 min 30 entre deux embranchements. Pour les histoires de 8 à 10 minutes, il impose aussi au moins 45 secondes entre deux choix.

Chaque choix signature possède aussi sa propre illustration dans `assets/stories/<story-id>/choices/`. Elle représente l’action comme une nouvelle page du livre, sans surcharger la petite carte. Le validateur interdit les images génériques, les réutilisations et les fichiers manquants pour ces histoires. Les créations d’enfant restent autorisées à employer les pictogrammes génériques avant leur consolidation parentale.
