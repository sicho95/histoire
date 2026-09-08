# Direction visuelle des choix

## Principe éditorial

Un embranchement équivaut à tourner une page du livre. Son image remplit donc deux fonctions inséparables : elle annonce clairement l’action que l’enfant peut choisir et elle illustre la nouvelle page possible dans le même univers.

La compréhension prime toujours sur la richesse décorative. À la taille d’une petite carte mobile, l’enfant doit reconnaître l’action avant même de savoir lire le texte placé dessous.

## Hiérarchie visuelle obligatoire

Chaque image consolidée contient :

1. une seule action principale ;
2. un seul indice ou objet important, montré assez grand ;
3. le héros ou le compagnon utile à l’action ;
4. un décor réduit à quelques signes de l’univers ;
5. aucune inscription dans l’image.

Les silhouettes, vêtements, couleurs, compagnons et accessoires récurrents restent identiques à la couverture et aux autres pages de la même histoire. Deux choix concurrents doivent se distinguer par leur geste et leur grand objet, pas seulement par une variation de couleur.

## Adaptation à l’âge

### 2–5 ans

- formes rondes, contrastes doux et émotions très lisibles ;
- un ou deux personnages principaux, trois seulement si le choix l’exige ;
- presque aucun élément d’arrière-plan ;
- un objet coloré surdimensionné ;
- action compréhensible à environ 120 px.

### 5–9 ans

- scène plus narrative et atmosphère plus riche ;
- détails secondaires autorisés s’ils ne concurrencent pas l’action ;
- expressions et mouvement plus nuancés ;
- continuité stricte avec l’univers et la progression du récit.

## Deux niveaux de production

Une histoire créée gratuitement par l’enfant reste d’abord un brouillon privé. Elle peut utiliser les pictogrammes génériques de `assets/choices/` afin de répondre immédiatement et sans coût.

Le lecteur peut proposer **Dire une autre idée** pour personnaliser un embranchement. Cette possibilité reste entièrement cachée si aucun LLM n’est configuré par le parent. Elle n’apparaît que lorsque la clé Groq gratuite est disponible, que l’appareil est en ligne et que la reconnaissance vocale fonctionne. La nouvelle branche reste privée sur l’appareil et utilise les pictogrammes génériques jusqu’à sa consolidation.

Une histoire consolidée ou signature ne peut plus utiliser ces pictogrammes. Chaque choix reçoit une illustration originale et unique dans `assets/stories/<story-id>/choices/<choice-id>.jpg`. Le validateur bloque la publication si un fichier manque, si une image est réutilisée ou si le chemin ne correspond pas à l’identifiant du choix.

## Chaîne de consolidation

1. relire la structure, la sécurité et les conséquences des choix ;
2. fixer la bible visuelle du héros, des compagnons et du monde ;
3. préparer une image distincte pour chaque choix selon l’âge ;
4. vérifier la compréhension sur une petite carte mobile ;
5. préparer la narration vocale scène par scène ;
6. valider l’ensemble puis publier sur GitHub.

Les images de lancement ont été produites avec ImageGen en planches cohérentes par histoire, puis découpées, contrôlées et optimisées en JPEG de 360 px de large. La recette exécutable et l’inventaire sont conservés dans `config/choice-art-direction.json`.

## Contrôle avant publication

- le geste correspondant au libellé est identifiable sans texte ;
- l’image n’est pas chargée à la taille réelle de la carte ;
- le personnage et l’univers sont cohérents avec la couverture ;
- les choix d’une même question ne peuvent pas être confondus ;
- le libellé reste affiché sous l’image, y compris en mode discret ;
- aucune donnée personnelle d’un enfant n’apparaît dans l’image ou son nom de fichier.
