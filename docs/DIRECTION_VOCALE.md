# Direction vocale durable

## Identité des narrateurs

Les histoires signature gardent les mêmes deux narrateurs français à chaque régénération :

- héroïne ou voix féminine : `fr-FR-VivienneMultilingualNeural` ;
- héros ou voix masculine : `fr-FR-RemyMultilingualNeural`.

Chaque histoire signature possède en plus une affectation explicite dans `storyVoices`. C’est ce verrou par identifiant qui garantit qu’une régénération future conserve exactement le même narrateur, même si d’autres métadonnées de l’histoire évoluent. Pour une nouvelle histoire, `heroVoice: "female"` ou `heroVoice: "male"` choisit Vivienne ou Remy, puis son affectation doit être ajoutée à `storyVoices` avant publication. Le fichier exécutable `config/voice-direction.json` est la source officielle des voix et des réglages ; le validateur audio refuse un manifeste qui ne les respecte pas.

## Jeu vocal par scène

L’identité de la voix reste fixe, mais la réalisation varie avec `narration.mood`, `narration.pace`, l’intensité et l’âge :

| Intention | Réalisation attendue |
| --- | --- |
| calme | plus lent, légèrement plus grave et plus doux |
| émerveillement | posé, lumineux, légère montée de hauteur |
| joie | un peu plus vif, plus lumineux, sans précipitation |
| mystère | plus lent, légèrement grave, silences naturels à la ponctuation |
| suspense | débit retenu, voix plus grave, tension non effrayante |
| peur douce | très posé, doux et rassurant |
| tristesse | lent, bas et tendre |
| triomphe | plus ouvert, lumineux et énergique |

Le profil `2-5` reste plus lent que le profil `5-9`, mais son débit de base est fixé à `-14 %` pour ne plus paraître excessivement étiré. Les questions sont encore ralenties, légèrement mises en avant et enregistrées dans une piste distincte. Elles commencent par « À toi de choisir », posent la question, puis annoncent distinctement « choix numéro 1 », « choix numéro 2 » et éventuellement « choix numéro 3 » avec le libellé exact affiché. Elles laissent ensuite explicitement à l’enfant le temps de toucher l’image portant le même numéro.

La saisie d’une autre idée n’est jamais un enregistrement à arrêter manuellement. Le micro attend au maximum quelques secondes le début de la parole, laisse l’enfant finir sa phrase, puis se coupe après environ une seconde de silence. Sans parole reconnue, aucune requête LLM n’est envoyée. Sur iPhone, la session passe temporairement en `play-and-record`, puis revient explicitement et systématiquement en `playback` avant toute voix afin que le son sorte par le haut-parleur normal et non par l’écouteur d’appel.

L’intensité `1`, `2` ou `3` module finement l’énergie à l’intérieur d’une même intention. Une scène pressée peut utiliser `pace: "lively"`, tandis que le stress et le suspense conservent un débit retenu pour rester compréhensibles et rassurants. Ces paramètres changent la réalisation, jamais le narrateur.

Une onomatopée n’est jamais laissée comme un mot isolé ou en capitales. Elle reste dans une phrase française complète — par exemple « la bulle éclate avec un petit plouf » — afin qu’une voix multilingue ne bascule pas vers une prononciation anglaise. En complément, `src/audio/french-speech.js` applique uniquement au texte envoyé à la voix un lexique phonétique central (`plouf → plouffe`, `ding → dingue`, `boum → boume`, `tin → tain`, etc.). Il retire aussi le balisage Markdown audible et lie les inversions françaises (`dit-il → ditil`, `a-t-elle → atelle`). Le texte correctement écrit reste inchangé à l’écran. Toute modification de cette préparation change `speechHash` et oblige le générateur à refaire la piste concernée.

## Régénération

Le moteur retenu est Edge TTS avec les voix neuronales françaises de Microsoft. Il faut installer `edge-tts`, puis lancer :

```bash
EDGE_TTS_BIN=/chemin/vers/edge-tts npm run generate:audio -- --force
npm run validate:audio
```

Les anciennes pistes ne doivent jamais être mélangées aux nouvelles. Une modification de `styleVersion` crée un nouveau cache audio PWA et supprime l’ancien lors de l’activation de la mise à jour.

Pour une future passe avec une voix de comédien ou un moteur plus expressif, conserver les identités par histoire, les pistes séparées par scène et par question, ainsi que les mêmes intentions. Le manifeste permet de remplacer les fichiers sans modifier le lecteur.

## Cascade en ligne et histoires personnalisées

L’ordre de lecture est volontairement déterministe :

1. MP3 éditorial correspondant exactement au texte de l’histoire signature ;
2. MP3 portable déjà importé ou généré sur cet appareil ;
3. Edge TTS gratuit via `proxy.sicho95.workers.dev/v1/tts/edge`, avec Vivienne ou Rémy et les réglages de la scène ;
4. essai Edge direct lorsque le navigateur Microsoft Edge le permet ;
5. Azure Speech si un parent a configuré une clé et une région ;
6. OpenAI TTS si une clé est configurée ;
7. Google AI Studio TTS si une clé est configurée ;
8. meilleure voix française installée sur l’appareil, avec vitesse et hauteur adaptées à l’âge.

Le navigateur ne contacte pas directement Microsoft sur Safari ou Firefox : le Worker ouvre la connexion nécessaire et transmet le MP3 une seule fois. La PWA enregistre immédiatement cette piste dans IndexedDB ; la lecture suivante et l’export ZIP utilisent la copie locale, sans nouveau transit Cloudflare. Un cache Cloudflare par texte, voix et prosodie évite aussi une régénération identique. Edge TTS reste un service non garanti : son échec doit être rapide et silencieux, puis déclencher Azure, OpenAI, Google ou la voix locale sans bloquer l’histoire. Les clés parentales restent dans la session de l’appareil et ne figurent jamais dans une histoire ni dans son export.

Le lecteur conserve un seul élément audio pendant toute la séance. Cette continuité est indispensable sur Safari et iOS : remplacer le lecteur entre les pistes peut perdre l’autorisation de lecture acquise par le geste de l’enfant et faire défiler une scène sans la raconter.

## Paquet vocal portable

L’export ZIP d’un brouillon contient une piste MP3 ou WAV distincte pour l’introduction, chaque scène et chaque question, plus un manifeste liant texte, voix et réglages. Une piste produite uniquement par la synthèse locale du téléphone n’est pas récupérable comme fichier par les navigateurs. L’archive reste néanmoins téléchargeable avec le récit complet et la liste précise des voix manquantes, afin qu’une repasse Edge, Azure, OpenAI ou Google puisse les compléter plus tard.

Après réimport, ces pistes portables passent avant toute synthèse en ligne. Une consolidation éditoriale peut ensuite reprendre le même paquet, relire le récit, améliorer les images et régénérer les voix sans changer l’identité du narrateur choisie pour l’histoire.
