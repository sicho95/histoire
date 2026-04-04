# Dossier histoires externes

Ajoute tes fichiers JSON d'histoires ici, puis référence-les dans `index.json` :

```json
["ma-super-histoire.json", "histoire-pirate.json"]
```

**Format attendu** : voir le template téléchargeable dans ⚙️ > Histoires > "Télécharger template vierge".

**Règles importantes** :
- `label` : strictement 1 mot, sans espace ni ponctuation
- `is_original: true` : exactement 1 choix par nœud
- `is_ending: true` → `choices: []` obligatoire
- Chaque nœud narratif : ~200 mots minimum (~1,5 min TTS)

Les histoires de ce dossier sont chargées **une seule fois** (si absentes d'IndexedDB).
