# Narrations éditoriales

Les narrations préparées sont placées dans ce dossier. Les histoires signature utilisent des M4A légers sous `audio/m4a/<story-id>/` ; des MP3 peuvent aussi être ajoutés.

`manifest.json` associe chaque scène à son fichier et à l'empreinte du texte. L'empreinte empêche l'application de lire une ancienne voix après la correction d'une scène.

```json
{
  "schemaVersion": 2,
  "styleVersion": "signature-fr-v1",
  "generatedAt": "2026-09-07T12:00:00Z",
  "tracks": {
    "mila-oeuf-orage:decision-1": {
      "file": "m4a/mila-oeuf-orage/decision-1.m4a",
      "textHash": "a1b2c3d4",
      "voice": "Flo",
      "model": "macos-say"
    }
  }
}
```

`npm run validate:audio` garantit que les 198 fichiers existent et correspondent encore exactement au texte publié. En l'absence de piste correspondante, la PWA utilise gratuitement une voix installée sur l'appareil. Une clé OpenAI parentale peut aussi produire une narration à la demande, mais elle n'est jamais nécessaire pour lire les histoires publiées.
