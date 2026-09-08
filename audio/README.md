# Narrations éditoriales

Les narrations préparées sont placées dans ce dossier. Les histoires signature utilisent des MP3 neuronaux français sous `audio/mp3/<story-id>/`.

`manifest.json` associe chaque scène à son fichier et à l'empreinte du texte. L'empreinte empêche l'application de lire une ancienne voix après la correction d'une scène.

```json
{
  "schemaVersion": 2,
  "styleVersion": "signature-fr-neural-v2",
  "generatedAt": "2026-09-07T12:00:00Z",
  "tracks": {
    "mila-oeuf-orage:decision-1": {
      "file": "mp3/mila-oeuf-orage/decision-1.mp3",
      "textHash": "a1b2c3d4",
      "voice": "fr-FR-VivienneMultilingualNeural",
      "model": "edge-tts",
      "format": "mp3",
      "ageBand": "5-9",
      "tuning": { "rate": "-19%", "pitch": "-3Hz", "volume": "+0%" }
    }
  }
}
```

`npm run validate:audio` garantit que les 198 fichiers existent et correspondent encore exactement au texte publié. En l'absence de piste correspondante, la PWA cherche un MP3 portable, tente Edge TTS gratuitement, utilise Azure Speech si une clé parentale est configurée, puis choisit la meilleure voix française installée sur l'appareil. Une clé OpenAI parentale reste une option séparée, mais aucune clé n'est nécessaire pour lire les histoires publiées.
