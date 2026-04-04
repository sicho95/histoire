import { getSettings } from '../storage/settings.js';
import { queryLlm } from '../api/router.js';
import { buildStoryPrompt } from '../api/prompts.js';
import { saveStory } from '../storage/database.js';
import { logDebug } from './debug.js';

const EMOJIS = ['✨','🌈','🗺️','🦊','🌟','🧭','🏰','🚀'];
const META_PATTERNS = [/prompt/i, /branche/i, /g[ée]n[ée]ration/i, /suite pr[ée]vue/i, /se rattache/i, /naturellement vers la suite/i, /nouvelle porte/i, /d[ée]tour/i];
const cleanWord = value => (String(value || 'Idée').trim().split(/\s+/)[0] || 'Idée').replace(/[^\p{L}\p{N}-]/gu, '').slice(0, 12) || 'Idée';

function getDescendants(story, node) {
  return (node.choices || []).map(choice => story.nodes?.[choice.next_node]).filter(Boolean).map(child => ({ id: child.id, headline: child.headline || child.id, is_ending: !!child.is_ending }));
}
function chooseRejoin(story, descendants) {
  return descendants.find(item => !item.is_ending) || descendants[0] || Object.values(story.nodes || {}).find(item => item.is_ending) || null;
}
function isUsableNarrative(text) {
  if (!text || text.length < 120) return false;
  return !META_PATTERNS.some(pattern => pattern.test(text));
}
function variantNarrative({ transcript, storyTitle, nodeTitle, rejoinTitle }) {
  const seed = String(transcript || 'surprise').trim();
  const hash = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % 4;
  const variants = [
    `${storyTitle} avance dans ${nodeTitle}. Soudain, ${seed} apparaît pour de vrai devant le héros : ce n'est pas une image vague, mais un détail bien concret qu'il peut toucher, suivre ou contourner. Il s'en approche, remarque un son, une odeur ou une lueur précise, puis comprend que ce choix change immédiatement la scène. En agissant, il provoque quelque chose d'utile : un passage se dévoile, un personnage répond, un objet caché devient accessible. Le héros doit alors décider vite comment profiter de cette découverte avant qu'elle ne disparaisse. Au loin, un signe familier annonce déjà ${rejoinTitle || 'la suite du chemin'}, comme si cette action ouvrait une vraie étape de l'aventure.` ,
    `Au moment où tout semblait bloqué dans ${nodeTitle}, le héros tente vraiment ${seed}. Le sol réagit, un rideau de feuilles s'écarte, et un petit espace secret apparaît entre deux pierres. À l'intérieur, il trouve un indice précis : une marque gravée, un ruban oublié ou un message très court qui l'aide à comprendre quoi faire ensuite. Cette scène n'explique rien de l'extérieur ; elle fait avancer l'aventure par des gestes, des sons et des découvertes bien visibles. En ressortant, le héros sent qu'il s'est rapproché de ${rejoinTitle || 'la prochaine étape'} et qu'il ne lui manque plus qu'un dernier choix pour continuer.` ,
    `Quand le héros prononce ${seed}, quelque chose bouge aussitôt dans ${nodeTitle}. Une branche basse se soulève, une lanterne se rallume ou un animal discret vient montrer un autre passage. Le héros le suit, traverse un court détour rempli de détails simples et rassurants, puis atteint un endroit utile qu'il n'aurait jamais vu autrement. Là, un élément important l'attend : une clé, une direction, une aide ou une preuve qui donne enfin du sens à ce qu'il cherchait. Ce n'est pas une parenthèse abstraite ; c'est une vraie scène d'aventure qui prépare le chemin vers ${rejoinTitle || 'la suite'} avec une conséquence claire.` ,
    `Dans ${nodeTitle}, le héros essaie ${seed} sans hésiter. Le résultat est immédiat : une cache s'ouvre, un courant d'air révèle une porte bien réelle, et un petit objet roule jusqu'à ses pieds. En le ramassant, il comprend que quelqu'un est passé par là avant lui et a laissé un moyen d'avancer. Il observe, compare, teste, puis choisit comment se servir de cette trouvaille. Chaque geste transforme la scène un peu plus, jusqu'à faire apparaître une issue concrète. Avant de repartir, il aperçoit enfin le signe qui mène vers ${rejoinTitle || 'la suite du voyage'}, prêt à reprendre l'aventure avec ce qu'il vient de gagner.`
  ];
  return variants[hash];
}
function createBranch({ story, node, label, emoji, headline, text, question, rejoinNodeId, choices }) {
  const branchId = `dyn_${Date.now()}`;
  const bridgeId = `${branchId}_bridge`;
  const altEndId = `${branchId}_end`;
  const rejoinTarget = rejoinNodeId && story.nodes?.[rejoinNodeId] ? rejoinNodeId : null;
  story.nodes[branchId] = { id: branchId, headline: headline || label, cover_emoji: emoji || '✨', text, question: question || 'Que faire ensuite ?', choices: [] };
  if (rejoinTarget) {
    const branchChoices = (choices || []).slice(0, 3).map((choice, index) => ({ label: cleanWord(choice.label || `Choix${index + 1}`), fallback_emoji: choice.fallback_emoji || EMOJIS[index % EMOJIS.length], next_node: index === 0 ? rejoinTarget : bridgeId, is_original: index === 0 }));
    while (branchChoices.length < 3) branchChoices.push({ label: ['Suivre','Chercher','Aider'][branchChoices.length], fallback_emoji: ['🌟','🗺️','🤝'][branchChoices.length], next_node: branchChoices.length === 0 ? rejoinTarget : bridgeId, is_original: branchChoices.length === 0 });
    story.nodes[branchId].choices = branchChoices.slice(0, 3);
    story.nodes[bridgeId] = { id: bridgeId, headline: 'Le retour', cover_emoji: '🧭', text: `Grâce à ce qu'il vient de découvrir, le héros retrouve un repère fiable et rejoint le chemin qui mène vers la scène suivante.`, question: '', is_ending: false, choices: [{ label: 'Continuer', fallback_emoji: '🌟', next_node: rejoinTarget, is_original: true }] };
  } else {
    story.nodes[branchId].choices = [
      { label: 'Suivre', fallback_emoji: '🌟', next_node: altEndId, is_original: true },
      { label: 'Aider', fallback_emoji: '🤝', next_node: altEndId },
      { label: 'Rire', fallback_emoji: '😄', next_node: altEndId }
    ];
  }
  story.nodes[altEndId] = { id: altEndId, headline: 'Fin douce', cover_emoji: '🌙', text: `Cette piste se termine calmement et garde sa place comme une variante complète de l'aventure.`, question: '', is_ending: true, choices: [] };
  const learnedChoice = { label: cleanWord(label), fallback_emoji: emoji || '✨', next_node: branchId, is_learned: true };
  node.choices = node.choices || [];
  node.choices.push(learnedChoice);
  logDebug('weaver.branch.created', { label: learnedChoice.label, branchId, rejoinTarget, headline: story.nodes[branchId].headline });
  return learnedChoice;
}
export async function weaveChoice({ story, node, transcript }) {
  const normalized = String(transcript || '').trim().toLowerCase();
  logDebug('weaver.start', { transcript, nodeId: node?.id, nodeHeadline: node?.headline });
  const direct = (node.choices || []).find(choice => normalized.includes(String(choice.label || '').toLowerCase()));
  if (direct) {
    logDebug('weaver.match.direct', { label: direct.label });
    return { matchedChoice: direct };
  }
  const descendants = getDescendants(story, node);
  const endings = Object.values(story.nodes || {}).filter(item => item.is_ending).map(item => ({ id: item.id, headline: item.headline || item.id }));
  const settings = getSettings();
  let matchedChoice = null;
  if (navigator.onLine && settings.apiKey) {
    try {
      const result = await queryLlm({ provider: settings.provider, apiKey: settings.apiKey, model: settings.model, prompt: buildStoryPrompt({ storyTitle: story.title, nodeTitle: node.headline || story.title, transcript, choices: node.choices || [], descendants, endings }) });
      const payload = result.data;
      const found = (node.choices || []).find(choice => String(choice.label || '').toLowerCase() === String(payload?.matchLabel || '').toLowerCase());
      if (found) {
        logDebug('weaver.match.model', { label: found.label });
        matchedChoice = found;
      } else if (payload?.generated?.text && isUsableNarrative(payload.generated.text)) {
        matchedChoice = createBranch({ story, node, label: payload.generated.label || cleanWord(transcript), emoji: payload.generated.cover_emoji || '✨', headline: payload.generated.headline || cleanWord(transcript), text: payload.generated.text, question: payload.generated.question || 'Que choisis-tu ?', rejoinNodeId: payload.generated.rejoin_node_id || chooseRejoin(story, descendants)?.id, choices: payload.generated.choices || [] });
        logDebug('weaver.model.branch', { rawText: result.rawText, label: matchedChoice.label, rejoin: payload.generated.rejoin_node_id || null });
      } else {
        logDebug('weaver.model.rejected', { rawText: result.rawText, parsed: payload, reason: 'unusable_narrative' });
      }
    } catch (error) {
      logDebug('weaver.model.error', { message: String(error) });
    }
  } else {
    logDebug('weaver.model.skip', { online: navigator.onLine, hasApiKey: !!settings.apiKey });
  }
  if (!matchedChoice) {
    const rejoin = chooseRejoin(story, descendants);
    matchedChoice = createBranch({ story, node, label: cleanWord(transcript), emoji: EMOJIS[String(transcript || '').length % EMOJIS.length], headline: `${cleanWord(transcript)} magique`, text: variantNarrative({ transcript, storyTitle: story.title, nodeTitle: node.headline || story.title, rejoinTitle: rejoin?.headline || '' }), question: 'Que faire ensuite ?', rejoinNodeId: rejoin?.id || '', choices: [{ label: 'Suivre', fallback_emoji: '🌟' }, { label: 'Chercher', fallback_emoji: '🗺️' }, { label: 'Aider', fallback_emoji: '🤝' }] });
    logDebug('weaver.fallback.branch', { label: matchedChoice.label, rejoin: rejoin?.id || null });
  }
  await saveStory(story);
  logDebug('weaver.saved', { storyId: story.id, nodeId: node.id });
  return { matchedChoice, createdChoice: matchedChoice };
}
