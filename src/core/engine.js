import { speak, stopSpeak } from '../audio/tts.js';
import { listenOnce } from '../audio/stt.js';
import { getSecrets } from '../storage/settings.js';
import { saveToLibrary } from '../storage/database.js';
import { currentNode, setView, state } from './state.js';
import { weaveChoice } from './weaver.js';
import { renderReader } from '../ui/reader.js';
import { renderEndScreen } from '../ui/end_screen.js';
import { showToast } from '../ui/toast.js';

let playbackToken = 0;

function narrationContext(node) {
  return { storyId: state.currentStory?.id, nodeId: node?.id, narration: node?.narration };
}

async function playCurrentNode(token = ++playbackToken) {
  const node = currentNode();
  if (!node) return;
  state.isNarrating = true;
  renderReader({ phase: 'narration' });
  await speak(node.text, narrationContext(node));
  if (token !== playbackToken) return;
  state.isNarrating = false;
  if (node.isEnding) return renderEndScreen();
  renderReader({ phase: 'choice' });
  await speak(node.question, { ...narrationContext(node), nodeId: `${node.id}-question`, narration: { ...node.narration, pace: 'slow' } });
}

export async function startStory(story) {
  const token = ++playbackToken;
  stopSpeak();
  state.currentStory = structuredClone(story);
  state.currentNodeId = story.startNode;
  state.path = [];
  setView('view-reader');
  const node = currentNode();
  state.path.push({ nodeId: node.id, headline: node.headline });
  state.isNarrating = true;
  renderReader({ phase: 'narration' });
  await speak(`${story.title}. ${story.intro}`, { storyId: story.id, nodeId: 'intro', narration: { mood: 'wonder', pace: 'slow', intensity: 2 } });
  if (token === playbackToken) await playCurrentNode(token);
}

export async function chooseOption(choice) {
  const token = ++playbackToken;
  stopSpeak();
  state.currentNodeId = choice.nextNode;
  const node = currentNode();
  if (!node) return showToast('Cette piste est incomplète. Le brouillon pourra être corrigé lors de la révision.');
  state.path.push({ nodeId: node.id, headline: node.headline, choice: choice.label });
  await playCurrentNode(token);
}

export async function handleVoiceChoice() {
  const node = currentNode();
  if (!node) return;
  if (!getSecrets().groqApiKey) return showToast('Un parent doit d’abord ajouter la clé Groq gratuite.');
  const button = document.getElementById('speak-choice');
  button.disabled = true;
  button.textContent = '🎧 Je t’écoute…';
  const transcript = await listenOnce();
  if (!transcript) {
    button.disabled = false;
    button.innerHTML = '<span>🎤</span> Dire une autre idée';
    return showToast('Je n’ai rien entendu. Tu peux réessayer ou toucher un choix.');
  }
  try {
    const result = await weaveChoice({ story: state.currentStory, node, transcript, path: state.path });
    if (result.story) state.currentStory = result.story;
    await chooseOption(result.matchedChoice);
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = '<span>🎤</span> Dire une autre idée';
  }
}

export function pauseAudio() { playbackToken += 1; stopSpeak(); state.isNarrating = false; renderReader({ phase: 'narration' }); }
export async function replayCurrentNode() { stopSpeak(); await playCurrentNode(++playbackToken); }
export function refreshFreeChoiceAvailability() { renderReader({ phase: currentNode()?.isEnding ? 'narration' : 'choice', preserve: true }); }
export function startStoryFromCarousel(story) { return startStory(story); }
export function replayQuestion() { const node = currentNode(); return node?.question ? speak(node.question, narrationContext(node)) : null; }
export function playLibraryAdventure(adventure) { return startStory(adventure.story || adventure); }

export async function saveCurrentAdventure() {
  if (!state.currentStory) return;
  return saveToLibrary({ title: state.currentStory.title, storyId: state.currentStory.id, path: state.path, endingNodeId: state.currentNodeId });
}
