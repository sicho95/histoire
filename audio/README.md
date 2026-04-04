# Dossier audio statique pré-généré

Ce dossier permet de livrer les MP3 des histoires de base directement avec le site,
**sans appeler l'API TTS au premier lancement**.

## Format du manifest.json

```json
{
  "gcp::fr-FR-Wavenet-A::Wavenet::a1b2c3d4": "0001_intro.mp3",
  "gcp::fr-FR-Wavenet-A::Wavenet::e5f6g7h8": "0002_node1.mp3"
}
```

La **clé** est l'ID de cache (visible dans les logs debug).
La **valeur** est le nom du fichier MP3 dans ce même dossier.

## Comment générer ce manifest

1. Lance l'app avec ta clé GCP configurée
2. Va dans ⚙️ > Hors-ligne > Précharger histoires de base
3. Exporte le ZIP complet (⚙️ > Accès > 📦 Exporter ZIP complet)
4. Dans le ZIP, récupère `audio_cache.json` et les fichiers `mp3/*.mp3`
5. Place les MP3 dans ce dossier
6. Génère le manifest à partir de `audio_cache.json` :
   ```
   { entry.id: "NNNN_xxx.mp3" } pour chaque entry
   ```
7. Commit + push → zéro token TTS pour les nouveaux utilisateurs
