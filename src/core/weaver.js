import { getSettings } from '../storage/settings.js';
import { queryLlm } from '../api/router.js';
import { buildStoryPrompt } from '../api/prompts.js';
export async function weaveChoice({ story, node, transcript }) {
  const labels = (node.choices || []).map(c => c.label.toLowerCase());
  const normalized = (transcript || '').trim().toLowerCase();
  const direct = node.choices?.find(c => normalized.includes(c.label.toLowerCase()));
  if (direct) return { matchedChoice: direct };
  const settings = getSettings();
  if (!navigator.onLine) return { matchedChoice: null, createdChoice: null };
  try {
    const payload = await queryLlm({ provider: settings.provider, apiKey: settings.apiKey, model: settings.model, prompt: buildStoryPrompt({ storyTitle: story.title, nodeText: node.text, question: node.question, transcript, choices: node.choices || [] }) });
    const matched = node.choices?.find(c => c.label.toLowerCase() === (payload.matchLabel || '').toLowerCase());
    if (matched) return { matchedChoice: matched };
    if (payload.new_choice?.label && payload.new_choice?.generated_text) {
      const id = `dyn_${Date.now()}`;
      const endId = `${id}_end`;
      story.nodes[id] = {
        id,
        text: payload.new_choice.generated_text,
        question: payload.new_choice.question || 'Que veux-tu faire ensuite ?',
        cover_emoji: payload.new_choice.fallback_emoji || '✨',
        choices: [
          { label: 'Encore', fallback_emoji: '🚪', next_node: endId, is_original: true },
          { label: 'Retour', fallback_emoji: '🏠', next_node: endId },
          { label: 'Dodo', fallback_emoji: '🌙', next_node: endId }
        ]
      };
      story.nodes[endId] = { id: endId, text: 'La petite aventure inventée se termine doucement et tout le monde rentre heureux.', question: '', is_ending: true, cover_emoji: '🌙', choices: [] };
      const choice = { label: payload.new_choice.label, fallback_emoji: payload.new_choice.fallback_emoji || '✨', next_node: id, is_learned: true };
      node.choices = node.choices || [];
      node.choices.push(choice);
      return { matchedChoice: choice, createdChoice: choice };
    }
  } catch {
    return { matchedChoice: null, createdChoice: null };
  }
  return { matchedChoice: null, createdChoice: null };
}
