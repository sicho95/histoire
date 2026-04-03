import { getSettings } from '../storage/settings.js';
import { queryLlm } from '../api/router.js';
import { buildStoryPrompt } from '../api/prompts.js';

function localFallback(story, node, transcript) {
  const seed = (transcript || 'surprise').trim();
  const pretty = seed.charAt(0).toUpperCase() + seed.slice(1);
  const id = `dyn_${Date.now()}`;
  const endId = `${id}_end`;
  story.nodes[id] = {
    id,
    headline: pretty,
    cover_emoji: '✨',
    text: `En répondant “${seed}”, l'enfant ouvre une toute nouvelle piste dans l'histoire. Un passage secret apparaît, rempli de petites lumières et de détails rassurants. Le héros avance avec curiosité, découvre un indice utile et comprend que cette idée n'était pas prévue au départ, mais qu'elle peut quand même trouver sa place. Peu à peu, l'aventure se raccroche au chemin principal. Tout devient plus clair, comme si l'histoire avait simplement attendu cette réponse pour continuer autrement, sans jamais perdre sa douceur ni son sens.`,
    question: 'Que faire ensuite ?',
    choices: [
      { label: 'Continuer', fallback_emoji: '🌟', next_node: endId, is_original: true },
      { label: 'Explorer', fallback_emoji: '🗺️', next_node: endId },
      { label: 'Rentrer', fallback_emoji: '🏠', next_node: endId }
    ]
  };
  story.nodes[endId] = {
    id: endId,
    headline: 'Retour',
    cover_emoji: '🌙',
    text: `Cette nouvelle idée mène à une petite fin alternative où tout se range calmement. Le héros garde en mémoire ce détour inventé et rentre fier d'avoir osé proposer quelque chose de nouveau.`,
    question: '',
    is_ending: true,
    choices: []
  };
  const newChoice = { label: seed.split(/\s+/)[0].slice(0, 12) || 'Idée', fallback_emoji: '✨', next_node: id, is_learned: true };
  node.choices = node.choices || [];
  node.choices.push(newChoice);
  return { matchedChoice: newChoice, createdChoice: newChoice };
}

export async function weaveChoice({ story, node, transcript, endingCount = 0 }) {
  const normalized = (transcript || '').trim().toLowerCase();
  const direct = (node.choices || []).find(choice => normalized.includes(String(choice.label || '').toLowerCase()));
  if (direct) return { matchedChoice: direct };
  const settings = getSettings();
  if (!navigator.onLine) return { matchedChoice: null, createdChoice: null };
  try {
    const payload = await queryLlm({
      provider: settings.provider,
      apiKey: settings.apiKey,
      model: settings.model,
      prompt: buildStoryPrompt({ storyTitle: story.title, nodeTitle: node.headline || story.title, transcript, choices: node.choices || [], endingCount })
    });
    const matched = (node.choices || []).find(choice => String(choice.label || '').toLowerCase() === String(payload?.matchLabel || '').toLowerCase());
    if (matched) return { matchedChoice: matched };
    const generated = payload?.new_choice;
    if (generated?.label && generated?.node?.text) {
      const id = `dyn_${Date.now()}`;
      const endId = `${id}_end`;
      story.nodes[id] = {
        id,
        headline: generated.node.headline || generated.label,
        cover_emoji: generated.fallback_emoji || '✨',
        text: generated.node.text,
        question: generated.node.question || 'Que choisis-tu ?',
        choices: (generated.node.choices || []).slice(0, 3).map((choice, idx) => ({
          label: (choice.label || `Choix${idx + 1}`).split(/\s+/)[0],
          fallback_emoji: choice.fallback_emoji || '✨',
          next_node: endId,
          is_original: idx === 0
        }))
      };
      story.nodes[endId] = {
        id: endId,
        headline: 'Fin',
        cover_emoji: '🌙',
        text: `Cette nouvelle branche se referme doucement et rejoint la fin de l'aventure avec une conclusion calme et cohérente.`,
        question: '',
        is_ending: true,
        choices: []
      };
      const choice = { label: String(generated.label).split(/\s+/)[0], fallback_emoji: generated.fallback_emoji || '✨', next_node: id, is_learned: true };
      node.choices = node.choices || [];
      node.choices.push(choice);
      return { matchedChoice: choice, createdChoice: choice };
    }
  } catch {}
  return localFallback(story, node, transcript);
}
