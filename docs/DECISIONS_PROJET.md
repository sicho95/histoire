# Décisions durables du projet

Ce document résume les règles que les futures évolutions doivent préserver. Les détails exécutables restent dans la configuration, les validateurs et les tests.

## Histoires signature

- Une histoire publiée est cohérente sur chacune de ses routes : personnage, objet et connaissance doivent être introduits avant usage.
- Un choix entraîne une conséquence racontée avant le prochain embranchement. Une question est toujours dite à voix haute, suivie de « choix numéro 1 », « choix numéro 2 » et éventuellement « choix numéro 3 » avec le libellé exact affiché et dans l’ordre visuel gauche-droite.
- L’enfant voit 2 ou 3 choix au maximum. Si les personnalisations en ont créé davantage, le sous-ensemble reste stable pendant la séance.
- Une illustration de choix est une page du livre : cohérente avec le héros et l’univers, mais centrée sur une seule action immédiatement reconnaissable à l’âge visé.
- Les illustrations signature n’ont aucune pastille numérotée superposée. Les brouillons `5-9 ans` montrent uniquement de grands chiffres `1`, `2`, `3` bleu, vert, rouge sur fond pêche ; les brouillons `2-5 ans` montrent de grands carrés unis bleu, vert, rouge, sans cercle intérieur.

## Génération personnalisée

- Le prompt transmet l’état causal récent de l’histoire, interdit les éléments non introduits et impose de simuler toutes les routes avant de rendre le JSON.
- Une branche personnalisée possède sa scène de décision, 2 ou 3 conséquences propres, puis rejoint uniquement un point compatible du récit.
- Le micro d’une autre idée s’arrête seul après la phrase ou après quelques secondes sans parole. Le LLM n’est appelé que si une transcription non vide existe.
- Groq produit le texte structuré. Il ne doit pas être présenté comme un générateur d’illustrations : les brouillons `2-5 ans` utilisent des cartes bleu, vert et rouge jusqu’à leur consolidation ; les plus grands gardent les cartes 1, 2 et 3 dans ces mêmes couleurs.
- En lecture, l’image du passage est l’illustration éditoriale du dernier choix. Une branche générée garde la couverture de l’histoire tant qu’une véritable illustration n’a pas été produite et validée.
- Pour les 2–5 ans, la longueur vient d’une suite de petites actions concrètes et répétées, jamais de longues phrases ou d’idées abstraites. Le vocabulaire vise une compréhension autour de 3 ans.
- L’atelier demande d’abord « héroïne » ou « héros », puis propose dix personnages accordés à ce choix. Après une création réussie, le formulaire repart vide.
- Une création commence directement par une scène de décision. Si un ancien brouillon contient un prologue linéaire, il est fusionné dans la première décision afin d’éviter un écran « Continuer » isolé.
- Les nuances vocales inventées par le LLM sont tolérées dans le JSON puis ramenées localement vers les émotions et rythmes autorisés ; une simple variante de mot ne doit pas faire échouer toute l’histoire.
- Un oubli isolé dans la structure Groq, notamment `storyBible.heroGoal`, ne doit pas faire perdre une longue génération : la PWA complète les métadonnées internes lorsqu’elle peut récupérer le JSON rejeté, sinon elle effectue une seule relance guidée. Après l’échec final, les choix du formulaire restent saisis et le message enfant ne montre pas le détail technique du schéma.
- La durée d’une création est mesurée sur chaque route réellement jouable, questions et choix lus compris, avec le débit observé des voix du projet (`120 mots/min` pour les `2-5 ans`, `145 mots/min` pour les `5-9 ans`). Une histoire visant dix minutes doit durer au moins neuf minutes sur sa route la plus courte ; sinon une passe éditoriale l’allonge automatiquement et un résultat encore trop court n’est pas enregistré.
- Une demande libre remplie déclenche une passe éditoriale dédiée. Le souhait doit agir sur le début, le conflit, plusieurs décisions et la fin. Une forte émotion se construit par le lien, la perte, le souvenir, le sacrifice et une réparation gagnée, jamais par la simple mention de tristesse ou de larmes.
- Les synonymes d’humeur produits par le LLM sont traduits vers les intentions vocales sûres (`sadness`, `suspense`, `calm`, `triumph`, etc.) au lieu de ramener presque toutes les scènes à `wonder`.

## Voix et portabilité

- Les histoires signature lisent d’abord leurs MP3 préparés et gardent Vivienne ou Rémy selon leur identité vocale verrouillée.
- La prononciation française est centralisée dans une transformation réservée à la synthèse vocale ; le texte écrit n’est jamais déformé. Elle retire les marques Markdown comme `*`, transforme notamment « Tin » en « tain » et lie les inversions (« dit-il » devient « ditil », « a-t-elle » devient « atelle »).
- Les créations suivent la cascade piste portable, Edge TTS via le Worker, Edge direct si possible, Azure Speech, OpenAI, Google AI Studio, puis voix française de l’appareil.
- Le Worker fabrique une piste Edge puis la PWA la stocke localement : les réécoutes et l’export ne sollicitent plus Cloudflare. Le Worker limite l’origine, le volume de texte et les deux voix françaises, et met en cache les doublons.
- Un seul lecteur audio persiste entre les scènes pour fiabiliser Safari/iOS.
- Sur les navigateurs qui exposent Audio Session, le micro utilise temporairement `play-and-record`, puis l’application rétablit toujours `playback` avant la narration afin d’éviter la sortie par l’écouteur téléphonique de l’iPhone.
- L’export parent est toujours un ZIP réimportable comprenant le récit, les informations de révision et toutes les pistes MP3 ou WAV disponibles. Les pistes impossibles à produire sont signalées dans le manifeste sans bloquer le ZIP. Aucun secret ni donnée personnelle ne doit être publié.

## PWA mobile

- `main` reste la source et `WebApp` le résultat statique publié. La version produit et le `buildId` technique restent distincts.
- Lecture et création s’adaptent à la hauteur de l’écran sans défilement ; seuls l’accueil et les espaces utilitaires peuvent défiler.
- Un texte trop long devient plusieurs pages, jamais une zone interne minuscule à faire défiler. En narration, elles avancent automatiquement avec la position du son ; en mode discret ou en relecture, l’enfant les tourne avec deux flèches simples.
- Le double toucher ne déclenche pas de zoom dans l’interface enfant.
- Le thème automatique, clair ou sombre occupe l’action supérieure. L’espace Parents n’existe qu’une fois, dans la navigation basse, derrière un code à quatre chiffres.
- L’atelier est dans Création. La bibliothèque publiée reste le centre de l’accueil.
- L’atelier est invisible sans clé LLM. L’onglet ne conserve que des histoires personnelles réellement rejouables, y compris celles enrichies d’une branche personnalisée, et non une simple liste de choix passés.
