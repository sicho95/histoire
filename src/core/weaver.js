import { getSettings } from '../storage/settings.js';
import { queryLlm } from '../api/router.js';
import { buildStoryPrompt } from '../api/prompts.js';
import { saveStory } from '../storage/database.js';

const EMOJIS = ['✨','🌈','🗺️','🦊','🌟','🧭','🏰','🚀'];
const cleanWord = value => (String(value || 'Idée').trim().split(/\s+/)[0] || 'Idée').replace(/[^\p{L}\p{N}-]/gu, '').slice(0, 12) || 'Idée';

function getDescendants(story, node) {
  return (node.choices || [])
    .map(choice => story.nodes?.[choice.next_node])
    .filter(Boolean)
    .map(child => ({ id: child.id, headline: child.headline || child.id, is_ending: !!child.is_ending }));
}

function chooseRejoin(story, descendants) {
  return descendants.find(node => !node.is_ending) || descendants[0] || Object.values(story.nodes || {}).find(node => node.is_ending) || null;
}

function buildLocalNarrative(seed, title) {
  return `Sous la lumière douce du lieu, ${title} suit la piste de ${seed}. Un détail jusque-là invisible apparaît près du chemin : une trace brillante, une porte cachée ou un petit bruit rassurant qui invite à avancer. En le suivant, le héros découvre une scène nouvelle, pleine d'images concrètes et de petits gestes utiles. Il essaie vraiment cette idée, observe ce qui change, puis comprend comment s'en servir pour continuer l'aventure. Rien n'est expliqué de l'extérieur : tout se passe dans l'histoire elle-même, comme si ce détour avait toujours pu exister à cet instant précis.`;
}

function createBranch({ story, node, label, emoji, headline, text, question, rejoinNodeId, choices }) {
  const branchId = `dyn_${Date.now()}`;
  const bridgeId = `${branchId}_bridge`;
  const altEndId = `${branchId}_end`;
  const rejoinTarget = rejoinNodeId && story.nodes?.[rejoinNodeId] ? rejoinNodeId : null;

  story.nodes[branchId] = {
    id: branchId,
    headline: headline || label,
    cover_emoji: emoji || '✨',
    text,
    question: question || 'Que faire ensuite ?',
    choices: []
  };

  if (rejoinTarget) {
    const branchChoices = (choices || []).slice(0, 3).map((choice, index) => ({
      label: cleanWord(choice.label || `Choix${index + 1}`),
      fallback_emoji: choice.fallback_emoji || EMOJIS[index % EMOJIS.length],
      next_node: index === 0 ? rejoinTarget : bridgeId,
      is_original: index === 0
    }));
    if (branchChoices.length < 3) {
      branchChoices.push({ label: 'Suivre', fallback_emoji: '🌟', next_node: rejoinTarget, is_original: branchChoices.length === 0 });
      branchChoices.push({ label: 'Chercher', fallback_emoji: '🗺️', next_node: bridgeId });
      branchChoices.push({ label: 'Aider', fallback_emoji: '🤝', next_node: bridgeId });
    }
    story.nodes[branchId].choices = branchChoices.slice(0, 3);
    story.nodes[bridgeId] = {
      id: bridgeId,
      headline: 'Le retour au chemin',
      cover_emoji: '🧭',
      text: `Après ce détour, le héros retrouve un signe familier qui le guide naturellement vers la suite prévue de l'aventure. Tout s'emboîte avec douceur et le chemin principal réapparaît devant lui.`,
      question: '',
      is_ending: false,
      choices: [{ label: 'Continuer', fallback_emoji: '🌟', next_node: rejoinTarget, is_original: true }]
    };
  } else {
    story.nodes[branchId].choices = [
      { label: 'Suivre', fallback_emoji: '🌟', next_node: altEndId, is_original: true },
      { label: 'Aider', fallback_emoji: '🤝', next_node: altEndId },
      { label: 'Rire', fallback_emoji: '😄', next_node: altEndId }
    ];
  }

  story.nodes[altEndId] = {
    id: altEndId,
    headline: 'Fin douce',
    cover_emoji: '🌙',
    text: `Cette nouvelle piste trouve sa propre conclusion calme et heureuse, puis se range comme un joli détour dans la mémoire de l'histoire.`,
    question: '',
    is_ending: true,
    choices: []
  };

  const learnedChoice = { label: cleanWord(label), fallback_emoji: emoji || '✨', next_node: branchId, is_learned: true };
  node.choices = node.choices || [];
  node.choices.push(learnedChoice);
  return learnedChoice;
}

export async function weaveChoice({ story, node, transcript }) {
  const normalized = String(transcript || '').trim().toLowerCase();
  const direct = (node.choices || []).find(choice => normalized.includes(String(choice.label || '').toLowerCase()));
  if (direct) return { matchedChoice: direct };

  const descendants = getDescendants(story, node);
  const endings = Object.values(story.nodes || {}).filter(item => item.is_ending).map(item => ({ id: item.id, headline: item.headline || item.id }));
  const settings = getSettings();
  let matchedChoice;

  if (navigator.onLine && settings.apiKey) {
    try {
      const payload = await queryLlm({
        provider: settings.provider,
        apiKey: settings.apiKey,
        model: settings.model,
        prompt: buildStoryPrompt({
          storyTitle: story.title,
          nodeTitle: node.headline || story.title,
          transcript,
          choices: node.choices || [],
          descendants,
          endings
        })
      });
      const found = (node.choices || []).find(choice => String(choice.label || '').toLowerCase() === String(payload?.matchLabel || '').toLowerCase());
      if (found) {
        matchedChoice = found;
      } else if (payload?.generated?.text) {
        matchedChoice = createBranch({
          story,
          node,
          label: payload.generated.label || cleanWord(transcript),
          emoji: payload.generated.cover_emoji || '✨',
          headline: payload.generated.headline || cleanWord(transcript),
          text: payload.generated.text,
          question: payload.generated.question || 'Que choisis-tu ?',
          rejoinNodeId: payload.generated.rejoin_node_id || chooseRejoin(story, descendants)?.id,
          choices: payload.generated.choices || []
        });
      }
    } catch {}
  }

  if (!matchedChoice) {
    const rejoin = chooseRejoin(story, descendants);
    matchedChoice = createBranch({
      story,
      node,
      label: cleanWord(transcript),
      emoji: EMOJIS[String(transcript || '').length % EMOJIS.length],
      headline: `${cleanWord(transcript)} magique`,
      text: buildLocalNarrative(transcript, story.title),
      question: 'Que faire ensuite ?',
      rejoinNodeId: rejoin?.id || '',
      choices: [
        { label: 'Suivre', fallback_emoji: '🌟' },
        { label: 'Chercher', fallback_emoji: '🗺️' },
        { label: 'Aider', fallback_emoji: '🤝' }
      ]
    });
  }

  await saveStory(story);
  return { matchedChoice, createdChoice: matchedChoice };
}
