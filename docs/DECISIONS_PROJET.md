# Décisions durables du projet

Ce document résume les règles que les futures évolutions doivent préserver. Les détails exécutables restent dans la configuration, les validateurs et les tests.

## Histoires signature

- Une histoire publiée est cohérente sur chacune de ses routes : personnage, objet et connaissance doivent être introduits avant usage.
- Un choix entraîne une conséquence racontée avant le prochain embranchement. Une question est toujours dite à voix haute, suivie du libellé exact des deux ou trois choix affichés, puis présentée en grand avec ses images et ses textes.
- L’enfant voit 2 ou 3 choix au maximum. Si les personnalisations en ont créé davantage, le sous-ensemble reste stable pendant la séance.
- Une illustration de choix est une page du livre : cohérente avec le héros et l’univers, mais centrée sur une seule action immédiatement reconnaissable à l’âge visé.

## Génération personnalisée

- Le prompt transmet l’état causal récent de l’histoire, interdit les éléments non introduits et impose de simuler toutes les routes avant de rendre le JSON.
- Une branche personnalisée possède sa scène de décision, 2 ou 3 conséquences propres, puis rejoint uniquement un point compatible du récit.
- Le micro d’une autre idée s’arrête seul après la phrase ou après quelques secondes sans parole. Le LLM n’est appelé que si une transcription non vide existe.
- Groq produit le texte structuré. Il ne doit pas être présenté comme un générateur d’illustrations ; les brouillons peuvent garder des pictogrammes avant consolidation.

## Voix et portabilité

- Les histoires signature lisent d’abord leurs MP3 préparés et gardent Vivienne ou Rémy selon leur identité vocale verrouillée.
- La prononciation française des onomatopées est centralisée dans une transformation réservée à la synthèse vocale ; le texte écrit de l’histoire n’est jamais déformé pour le TTS.
- Les créations suivent la cascade MP3 portable, Edge TTS, Azure Speech, voix française de l’appareil.
- Un seul lecteur audio persiste entre les scènes pour fiabiliser Safari/iOS.
- L’export parent est un ZIP réimportable comprenant le récit, les informations de révision et tous les MP3 disponibles. Aucun secret ni donnée personnelle ne doit être publié.

## PWA mobile

- `main` reste la source et `WebApp` le résultat statique publié. La version produit et le `buildId` technique restent distincts.
- Lecture et création s’adaptent à la hauteur de l’écran sans défilement ; seuls l’accueil et les espaces utilitaires peuvent défiler.
- Un texte trop long devient plusieurs pages, jamais une zone interne minuscule à faire défiler. En narration, elles avancent automatiquement avec la position du son ; en mode discret ou en relecture, l’enfant les tourne avec deux flèches simples.
- Le double toucher ne déclenche pas de zoom dans l’interface enfant.
- Le thème automatique, clair ou sombre occupe l’action supérieure. L’espace Parents n’existe qu’une fois, dans la navigation basse, derrière un code à quatre chiffres.
- L’atelier est dans Création. La bibliothèque publiée reste le centre de l’accueil.
- L’atelier est invisible sans clé LLM. L’onglet ne conserve que des histoires personnelles réellement rejouables, y compris celles enrichies d’une branche personnalisée, et non une simple liste de choix passés.
