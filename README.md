# Histoires

PWA mobile de contes interactifs pour enfants. Elle distingue deux circuits :

- **Bibliothèque éditoriale** : histoires relues dans `stories/`, publiées par GitHub et éventuellement accompagnées de MP3 dans `audio/`.
- **Atelier enfant** : histoires inventées gratuitement avec Groq, conservées comme brouillons privés sur l'appareil, puis exportables pour révision.

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
4. Ajouter les MP3 facultatifs et leurs entrées dans `audio/manifest.json`.

Voir [stories/README.md](stories/README.md) et [audio/README.md](audio/README.md).

## Génération gratuite

La génération utilise l'offre gratuite Groq avec `openai/gpt-oss-120b` et des sorties JSON structurées. La clé est saisie dans l'espace parents et reste en session par défaut. Elle n'est jamais ajoutée au dépôt ou aux exports.

## Vie privée

Une création d'enfant reste locale tant qu'un parent ne l'exporte pas. L'export de révision rappelle de retirer nom complet, école, adresse, voix ou autre information personnelle avant toute publication dans un dépôt public.
