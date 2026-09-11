import { speak, stopSpeak } from '../audio/tts.js';
import { listenOnce, stopListening } from '../audio/stt.js';
import { buildSpokenChoicePrompt } from '../audio/choice-prompt.js';
import { getSecrets, getSettings } from '../storage/settings.js';
import { currentNode, setView, state } from './state.js';
import { weaveChoice } from './weaver.js';
import { renderReader, syncReaderToNarration } from '../ui/reader.js';
import { renderEndScreen } from '../ui/end_screen.js';
import { showToast } from '../ui/toast.js';
import { pickDisplayChoices } from './choices.js';
import { restorePlaybackAudioSession } from '../audio/audio-session.js';

let playbackToken = 0;

function narrationContext(node) {
  return { storyId: state.currentStory?.id, nodeId: node?.id, narration: node?.narration, heroVoice: state.currentStory?.heroVoice, ageBand: state.currentStory?.ageBand };
}

async function playCurrentNode(token = ++playbackToken) {
  const node = currentNode();
  if (!node) return;
  if (getSettings().quietMode) {
    state.isNarrating = false;
    if (node.isEnding) return renderReader({ phase: 'quiet-ending' });
    if (node.nextNode) return renderReader({ phase: 'quiet-continuation' });
    return renderReader({ phase: 'quiet-decision' });
  }
  state.isNarrating = true;
  renderReader({ phase: 'narration', resetPage: true });
  await speak(node.text, { ...narrationContext(node), onProgress: progress => syncReaderToNarration(node.id, progress) });
  if (token !== playbackToken) return;
  state.isNarrating = false;
  if (node.isEnding) return renderEndScreen();
  if (node.nextNode) {
    await new Promise(resolve => setTimeout(resolve, 650));
    if (token !== playbackToken) return;
    state.currentNodeId = node.nextNode;
    const next = currentNode();
    state.path.push({ nodeId: next.id, headline: next.headline, automatic: true });
    return playCurrentNode(token);
  }
  await askCurrentQuestion(token);
}

async function askCurrentQuestion(token = playbackToken) {
  const node = currentNode();
  if (!node?.question) return;
  const displayedChoices = pickDisplayChoices(node);
  const spokenPrompt = buildSpokenChoicePrompt(node.question, displayedChoices);
  state.isNarrating = true;
  renderReader({ phase: 'choice', preserve: true });
  await speak(spokenPrompt, { ...narrationContext(node), nodeId: `${node.id}-question`, narration: { ...node.narration, pace: 'slow' } });
  if (token !== playbackToken) return;
  state.isNarrating = false;
  renderReader({ phase: 'choice', preserve: true });
}

export async function startStory(story) {
  const token = ++playbackToken;
  stopSpeak();
  stopListening();
  state.currentStory = structuredClone(story);
  state.currentNodeId = story.startNode;
  state.path = [];
  setView('view-reader');
  const node = currentNode();
  state.path.push({ nodeId: node.id, headline: node.headline });
  state.isNarrating = true;
  renderReader({ phase: 'narration' });
  if (!getSettings().quietMode) await speak(`${story.title}. ${story.intro}`, { storyId: story.id, nodeId: 'intro', heroVoice: story.heroVoice, ageBand: story.ageBand, narration: { mood: 'wonder', pace: 'slow', intensity: 2 } });
  if (token === playbackToken) await playCurrentNode(token);
}

export async function chooseOption(choice) {
  const token = ++playbackToken;
  stopSpeak();
  stopListening();
  state.currentNodeId = choice.nextNode;
  const node = currentNode();
  if (!node) return showToast('Cette piste est incomplète. Le brouillon pourra être corrigé lors de la révision.');
  state.path.push({ nodeId: node.id, headline: node.headline, choice: choice.label, illustration: choice.illustration || '', learned: Boolean(choice.learned) });
  await playCurrentNode(token);
}

export async function handleVoiceChoice() {
  const node = currentNode();
  if (!node) return;
  if (!getSecrets().groqApiKey) return showToast('Un parent doit d’abord ajouter la clé Groq gratuite.');
  const button = document.getElementById('speak-choice');
  const help = document.getElementById('voice-help');
  button.disabled = true;
  button.textContent = '🎧 Parle maintenant…';
  help.textContent = 'L’écoute s’arrête toute seule après ta phrase.';
  help.classList.remove('hidden');
  const transcript = await listenOnce();
  await restorePlaybackAudioSession();
  if (!transcript) {
    button.disabled = false;
    button.innerHTML = '<span>🎤</span> Dire une autre idée';
    help.classList.add('hidden');
    return showToast('Je n’ai rien entendu. Tu peux réessayer ou toucher un choix.');
  }
  button.textContent = '✨ J’imagine la suite…';
  help.textContent = `J’ai entendu : « ${transcript} »`;
  try {
    const result = await weaveChoice({ story: state.currentStory, node, transcript, path: state.path, displayedChoices: pickDisplayChoices(node) });
    if (result.story) state.currentStory = result.story;
    await chooseOption(result.matchedChoice);
  } catch (error) {
    showToast(error.message);
  } finally {
    stopListening();
    button.disabled = false;
    button.innerHTML = '<span>🎤</span> Dire une autre idée';
    help.classList.add('hidden');
  }
}

export function pauseAudio() { playbackToken += 1; stopSpeak(); stopListening(); state.isNarrating = false; renderReader({ phase: state.readerPhase, preserve: true }); }
export async function replayCurrentNode() { stopSpeak(); await playCurrentNode(++playbackToken); }
export function refreshFreeChoiceAvailability() { renderReader({ phase: state.readerPhase, preserve: true }); }
export function startStoryFromCarousel(story) { return startStory(story); }
export async function replayQuestion() { const token = ++playbackToken; stopSpeak(); return askCurrentQuestion(token); }
export async function continueQuietReading() {
  const token = ++playbackToken;
  const node = currentNode();
  if (!node) return;
  if (node.isEnding) return renderEndScreen();
  if (!node.nextNode) return renderReader({ phase: 'choice' });
  state.currentNodeId = node.nextNode;
  const next = currentNode();
  state.path.push({ nodeId: next.id, headline: next.headline, automatic: true });
  return playCurrentNode(token);
}
export async function refreshNarrationMode() {
  const token = ++playbackToken;
  stopSpeak();
  const node = currentNode();
  if (!node) return;
  if (!getSettings().quietMode && state.readerPhase === 'choice' && node.question) return askCurrentQuestion(token);
  return playCurrentNode(token);
}
export function playLibraryAdventure(adventure) { return startStory(adventure.story || adventure); }
