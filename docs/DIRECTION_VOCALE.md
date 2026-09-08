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

Le profil `2-5` est sensiblement plus lent que le profil `5-9`. Les questions sont encore ralenties, légèrement mises en avant et enregistrées dans une piste distincte. Elles commencent par « À toi de choisir » et laissent explicitement à l’enfant le temps de regarder les images.

L’intensité `1`, `2` ou `3` module finement l’énergie à l’intérieur d’une même intention. Une scène pressée peut utiliser `pace: "lively"`, tandis que le stress et le suspense conservent un débit retenu pour rester compréhensibles et rassurants. Ces paramètres changent la réalisation, jamais le narrateur.

## Régénération

Le moteur retenu est Edge TTS avec les voix neuronales françaises de Microsoft. Il faut installer `edge-tts`, puis lancer :

```bash
EDGE_TTS_BIN=/chemin/vers/edge-tts npm run generate:audio -- --force
npm run validate:audio
```

Les anciennes pistes ne doivent jamais être mélangées aux nouvelles. Une modification de `styleVersion` crée un nouveau cache audio PWA et supprime l’ancien lors de l’activation de la mise à jour.

Pour une future passe avec une voix de comédien ou un moteur plus expressif, conserver les identités par histoire, les pistes séparées par scène et par question, ainsi que les mêmes intentions. Le manifeste permet de remplacer les fichiers sans modifier le lecteur.
