export function buildStoryPrompt({ storyTitle, nodeText, question, transcript, choices }) {
  return `Tu es un conteur pour enfant de 4 à 8 ans. Histoire: ${storyTitle}. Passage courant: ${nodeText}. Question: ${question}. Réponse enfant: ${transcript}. Choix existants: ${choices.map(c => c.label).join(', ')}. Réponds en JSON avec {"matchLabel":"..."} si la réponse ressemble à un choix existant; sinon {"new_choice":{"label":"MotUnique","fallback_emoji":"✨","generated_text":"suite d'environ 120 à 180 mots pour enfants","question":"question courte avec 3 choix max"}}.`;
}
