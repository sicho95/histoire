# Narrations éditoriales

Les MP3 préparés sont placés dans ce dossier, idéalement sous `audio/mp3/<story-id>/`.

`manifest.json` associe chaque scène à son fichier et à l'empreinte du texte. L'empreinte empêche l'application de lire une ancienne voix après la correction d'une scène.

```json
{
  "schemaVersion": 2,
  "styleVersion": "warm-storyteller-v2",
  "generatedAt": "2026-09-07T12:00:00Z",
  "tracks": {
    "ines-chateau-nuages:start": {
      "file": "mp3/ines-chateau-nuages/start.mp3",
      "textHash": "a1b2c3d4",
      "voice": "marin",
      "model": "gpt-4o-mini-tts"
    }
  }
}
```

En l'absence de piste correspondante, la PWA utilise gratuitement une voix installée sur l'appareil. Une clé OpenAI parentale peut aussi produire une narration à la demande, mais elle n'est jamais nécessaire pour lire les histoires publiées.
