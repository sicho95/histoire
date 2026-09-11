# Histoires

PWA mobile de contes interactifs pour enfants. Elle distingue deux circuits :

- **Bibliothèque éditoriale** : histoires relues dans `stories/`, publiées par GitHub et accompagnées de narrations préparées dans `audio/`.
- **Atelier enfant** : histoires inventées gratuitement avec Groq, conservées comme brouillons privés sur l'appareil, puis exportables pour révision.

La version 2.4 comprend six histoires signature originales : deux aventures de 8 minutes et deux de 20 minutes pour les 5–9 ans, puis deux histoires de 10 à 12 minutes pour les 2–5 ans. Les deux récits des petits ont été entièrement réécrits en phrases courtes et concrètes, sans réduire leur durée. L’ensemble propose de 5 à 10 décisions, trois fins, des couvertures illustrées, 90 illustrations de choix originales et 198 pistes vocales françaises incluses.

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

Les histoires publiées dans `stories/` sont la source éditoriale conservée sur GitHub. `content/signature-stories.mjs` sert de graine pour une première fabrication ; une exécution normale préserve les JSON déjà relus. L’option volontaire `--force-seed` est nécessaire pour les remplacer depuis la graine. La chaîne complète utilise :

```bash
npm run generate:stories
npm run generate:audio
npm run check
```

La génération audio gratuite utilise deux voix neuronales françaises fixes : Vivienne pour les héroïnes et Rémy pour les héros. Le débit général est volontairement lent et varie ensuite selon l’âge, le rythme et l’émotion de chaque scène. Les MP3 ne sont pas tous préchargés lors de l’installation : ils sont mis en cache à la première écoute pour garder une PWA légère, puis restent disponibles hors connexion. La direction vocale complète et ses paramètres exécutables sont conservés dans [docs/DIRECTION_VOCALE.md](docs/DIRECTION_VOCALE.md) et `config/voice-direction.json`.

Pour les histoires consolidées, un embranchement est traité comme une nouvelle page illustrée : l’image reste simple et immédiatement identifiable, tout en conservant le héros et l’univers du récit. Les brouillons gratuits peuvent utiliser des pictogrammes génériques jusqu’à leur révision. La charte et ses contrôles sont conservés dans [docs/DIRECTION_VISUELLE_CHOIX.md](docs/DIRECTION_VISUELLE_CHOIX.md) et `config/choice-art-direction.json`.

Les scènes proposent 2 ou 3 choix préparés. Quand une histoire accumule davantage de possibilités personnalisées, la PWA en montre seulement 2 ou 3, de façon stable pendant la lecture, pour ne pas surcharger l’enfant. Le bouton **Dire une autre idée** permet une branche personnalisée uniquement si un parent a configuré le LLM gratuit, si l’appareil est en ligne et si la reconnaissance vocale est disponible ; il reste caché dans tous les autres cas.

À chaque embranchement, la narration pose la question puis lit distinctement les choix numéro 1, 2 et éventuellement 3. Le même numéro apparaît sur la carte. Pour une autre idée, le micro attend quelques secondes le début de la parole, s’arrête automatiquement après le silence qui suit la phrase et n’appelle jamais le LLM si rien n’a été dit. Sur iPhone, la sortie audio repasse ensuite explicitement en mode haut-parleur de lecture.

Voir [stories/README.md](stories/README.md) et [audio/README.md](audio/README.md).

## Création, voix et export

La génération utilise l'offre gratuite Groq avec `openai/gpt-oss-120b` et des sorties JSON structurées. La clé est saisie dans l'espace parents et reste en session par défaut. Elle n'est jamais ajoutée au dépôt ou aux exports.

La lecture suit une cascade explicite : MP3 éditorial inclus, piste portable importée, Edge TTS gratuit via le Worker Sicho95, essai Edge direct dans Microsoft Edge, Azure Speech si configuré, OpenAI si configuré, Google AI Studio si configuré, puis meilleure voix française de l’appareil. Le Worker ne sert qu’à fabriquer la piste Edge : l’audio traverse Cloudflare une seule fois, est enregistré dans IndexedDB, puis toutes les réécoutes et l’export utilisent la copie locale. Le lecteur réutilise un unique élément audio et restaure le mode `playback` après le micro sur Safari/iOS.

Un brouillon peut être exporté en ZIP contenant toujours l’histoire et le dossier de révision, plus toutes les pistes MP3 ou WAV générables. Une panne de voix en ligne ne bloque plus l’archive : le manifeste liste les pistes manquantes pour une repasse ultérieure. Le même ZIP se réimporte dans la PWA et garde ses voix hors connexion ; un parent peut aussi le relire puis l’intégrer au dépôt comme nouvelle histoire consolidée.

## Expérience mobile

La lecture et les trois étapes de création occupent exactement l’écran disponible, sans défilement vertical ou horizontal. Les textes longs sont découpés selon la hauteur : pendant la narration, la page visible suit automatiquement l’avancement du MP3 ; en mode discret ou lors d’une relecture, les flèches permettent de tourner les pages soi-même. Le double toucher ne zoome pas l’interface enfant. L’accueil reste défilable pour parcourir la bibliothèque. Le bouton supérieur règle le thème automatique, clair ou sombre ; l’espace Parents reste en bas et exige un code à quatre chiffres. L’atelier d’invention appartient à l’onglet Création et reste invisible sans clé Groq. Seules les histoires personnelles rejouables y sont conservées : une simple liste des choix effectués n’est pas une création.

## Vie privée

Une création d'enfant reste locale tant qu'un parent ne l'exporte pas. L'export de révision rappelle de retirer nom complet, école, adresse, voix ou autre information personnelle avant toute publication dans un dépôt public.

Les décisions durables et leurs raisons sont regroupées dans [docs/DECISIONS_PROJET.md](docs/DECISIONS_PROJET.md).
