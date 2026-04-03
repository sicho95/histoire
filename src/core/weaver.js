import { getSettings } from '../storage/settings.js';
import { queryLlm } from '../api/router.js';
import { buildStoryPrompt } from '../api/prompts.js';
import { saveStory } from '../storage/database.js';
const EMOJIS = ['✨','🌈','🗺️','🦊','🌟','🧭','🏰','🚀'];
function wordFrom(text) { return (String(text || 'Idée').trim().split(/\s+/)[0] || 'Idée').replace(/[^\p{L}\p{N}-]/gu, '').slice(0, 12) || 'Idée'; }
async function persist(story) { await saveStory(story); }
function localFallback(story, node, transcript) {
  const seed = String(transcript || 'surprise').trim();
  const label = wordFrom(seed);
  const emoji = EMOJIS[seed.length % EMOJIS.length];
  const id = `dyn_${Date.now()}`;
  const endId = `${id}_end`;
  story.nodes[id] = {
    id,
    headline: `${label} magique`,
    cover_emoji: emoji,
    text: `Cette fois, le héros essaie vraiment l'idée “${seed}”. Le décor change autour de lui : un passage apparaît, des détails nouveaux prennent vie, et l'histoire avance différemment. Cette réponse inventée ouvre une scène unique, avec un indice, un petit danger sans peur, puis une solution douce qui permet de continuer l'aventure sans casser sa logique. L'idée de l'enfant n'est donc pas répétée mécaniquement : elle devient une vraie suite, adaptée à ce moment précis de l'histoire.`,
    question: 'Et maintenant ?',
    choices: [
      { label: 'Suivre', fallback_emoji: '🗺️', next_node: endId, is_original: true },
      { label: 'Aider', fallback_emoji: '🤝', next_node: endId },
      { label: 'Rire', fallback_emoji: '😄', next_node: endId }
    ]
  };
  story.nodes[endId] = { id: endId, headline: 'Fin douce', cover_emoji: '🌙', text: `La nouvelle piste se referme calmement et enrichit désormais l'histoire pour les prochaines lectures.`, question: '', is_ending: true, choices: [] };
  const choice = { label, fallback_emoji: emoji, next_node: id, is_learned: true };
  node.choices = node.choices || [];
  node.choices.push(choice);
  return { matchedChoice: choice, createdChoice: choice };
}
export async function weaveChoice({ story, node, transcript, endingCount = 0 }) {
  const normalized = String(transcript || '').trim().toLowerCase();
  const direct = (node.choices || []).find(c => normalized.includes(String(c.label || '').toLowerCase()));
  if (direct) return { matchedChoice: direct };
  const settings = getSettings();
  let result = null;
  if (navigator.onLine && settings.apiKey) {
    try {
      const payload = await queryLlm({ provider: settings.provider, apiKey: settings.apiKey, model: settings.model, prompt: buildStoryPrompt({ storyTitle: story.title, nodeTitle: node.headline || story.title, transcript, choices: node.choices || [], endingCount }) });
      const matched = (node.choices || []).find(c => String(c.label || '').toLowerCase() === String(payload?.matchLabel || '').toLowerCase());
      if (matched) result = { matchedChoice: matched };
      else if (payload?.new_choice?.label && payload?.new_choice?.node?.text) {
        const id = `dyn_${Date.now()}`;
        const endId = `${id}_end`;
        story.nodes[id] = { id, headline: payload.new_choice.node.headline || payload.new_choice.label, cover_emoji: payload.new_choice.fallback_emoji || '✨', text: payload.new_choice.node.text, question: payload.new_choice.node.question || 'Que choisis-tu ?', choices: (payload.new_choice.node.choices || []).slice(0,3).map((c, i) => ({ label: wordFrom(c.label || `Choix${i+1}`), fallback_emoji: c.fallback_emoji || '✨', next_node: endId, is_original: i === 0 })) };
        story.nodes[endId] = { id: endId, headline: 'Fin', cover_emoji: '🌙', text: 'Cette branche nouvelle devient une vraie partie de l aventure.', question: '', is_ending: true, choices: [] };
        const choice = { label: wordFrom(payload.new_choice.label), fallback_emoji: payload.new_choice.fallback_emoji || '✨', next_node: id, is_learned: true };
        node.choices = node.choices || []; node.choices.push(choice);
        result = { matchedChoice: choice, createdChoice: choice };
      }
    } catch {}
  }
  if (!result) result = localFallback(story, node, transcript);
  await persist(story);
  return result;
}
