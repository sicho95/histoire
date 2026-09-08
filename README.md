# Histoires

PWA mobile de contes interactifs pour enfants. Elle distingue deux circuits :

- **Bibliothèque éditoriale** : histoires relues dans `stories/`, publiées par GitHub et accompagnées de narrations préparées dans `audio/`.
- **Atelier enfant** : histoires inventées gratuitement avec Groq, conservées comme brouillons privés sur l'appareil, puis exportables pour révision.

La version 2.1 comprend six histoires signature originales : deux aventures de 8 minutes et deux de 20 minutes pour les 5–9 ans, puis deux histoires de 10 minutes pour les 2–5 ans. Elles proposent de 5 à 10 décisions, trois fins, des couvertures illustrées, des pictogrammes de choix et 198 pistes vocales françaises incluses.

## Développement

```bash
npm install
npm run check
python3 -m http.server 8080
```

Ouvrir `http://localhost:8080`.

## Publication PWA

`main` contient les sources. À chaque poussée, GitHub Actions :

1. valide les histoires et les tests ;
2. construit `.webapp-build/` ;
3. génère un `buildId` technique distinct de la version produit ;
4. publie le résultat dans la branche `WebApp`.

GitHub Pages doit servir la racine de la branche `WebApp`. L'application compare régulièrement son `buildId` à `version.json` et propose immédiatement la nouvelle version sans interrompre une lecture en cours.

## Ajouter une histoire publiée

1. Ajouter `stories/mon-histoire.json` au format v2.
2. L'ajouter dans `stories/catalog.json` avec une `revision` supérieure.
3. Lancer `npm run validate:stories`.
4. Ajouter les pistes audio facultatives et leurs entrées dans `audio/manifest.json`.

Les histoires signature sont écrites dans `content/signature-stories.mjs`, puis produites avec :

```bash
npm run generate:stories
npm run generate:audio
npm run check
```

La génération audio gratuite utilise deux voix neuronales françaises fixes : Vivienne pour les héroïnes et Rémy pour les héros. Le débit général est volontairement lent et varie ensuite selon l’âge, le rythme et l’émotion de chaque scène. Les MP3 ne sont pas tous préchargés lors de l’installation : ils sont mis en cache à la première écoute pour garder une PWA légère, puis restent disponibles hors connexion. La direction vocale complète et ses paramètres exécutables sont conservés dans [docs/DIRECTION_VOCALE.md](docs/DIRECTION_VOCALE.md) et `config/voice-direction.json`.

Voir [stories/README.md](stories/README.md) et [audio/README.md](audio/README.md).

## Génération gratuite

La génération utilise l'offre gratuite Groq avec `openai/gpt-oss-120b` et des sorties JSON structurées. La clé est saisie dans l'espace parents et reste en session par défaut. Elle n'est jamais ajoutée au dépôt ou aux exports.

## Vie privée

Une création d'enfant reste locale tant qu'un parent ne l'exporte pas. L'export de révision rappelle de retirer nom complet, école, adresse, voix ou autre information personnelle avant toute publication dans un dépôt public.
