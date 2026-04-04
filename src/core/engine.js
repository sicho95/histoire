import { speak, stopSpeak, primeTts } from '../audio/tts.js';
import { listenOnce } from '../audio/stt.js';
import { currentNode, state, setView } from './state.js';
import { renderReader } from '../ui/reader.js';
import { renderEndScreen } from '../ui/end_screen.js';
import { weaveChoice } from './weaver.js';
import { logDebug } from './debug.js';
import { checkInternet, shouldAllowFreeChoice } from './network.js';
function resolveRandom(choice) {
  if (!choice?.__random) return choice;
  const pool = (choice.pool || []).filter(Boolean);
  const picked = pool[Math.floor(Math.random() * pool.length)] || null;
  logDebug('choice.random', { pool: pool.map(item => item.label), picked: picked?.label || null });
  return picked;
}
function syncVoiceButton() {
  const btn = document.getElementById('btn-speak');
  if (!btn) return;
  btn.style.display = shouldAllowFreeChoice() ? 'inline-flex' : 'none';
}
async function showQuestionStage(node) {
  await checkInternet(true);
  renderReader({ mode: 'question' });
  syncVoiceButton();
  if (node.question) await speak(node.question);
}
async function speakNodeSequence(node) {
  if (!node) return;
  renderReader({ mode: 'cover' });
  logDebug('reader.node.start', { nodeId: node.id, headline: node.headline });
  await speak(node.text || '');
  if (node.is_ending) return renderEndScreen();
  await showQuestionStage(node);
}
export function refreshFreeChoiceAvailability() { syncVoiceButton(); }
export function startStoryFromCarousel(story) {
  primeTts();
  stopSpeak();
  state.currentStory = story;
  state.currentNodeId = story.start_node || 'start';
  state.path = [];
  renderReader({ mode: 'cover' });
  const node = currentNode();
  state.path.push({ id: node.id, headline: node.headline, text: node.text, question: node.question });
  logDebug('story.start', { storyId: story.id, title: story.title });
  speak(`${story.title}. ${story.intro || 'Installe-toi bien, l histoire commence.'}`).then(() => speakNodeSequence(node));
}
export async function chooseOption(choice) {
  stopSpeak();
  const resolved = resolveRandom(choice);
  if (!resolved) return;
  resolved.play_count = (resolved.play_count || 0) + 1;
  state.currentNodeId = resolved.next_node;
  const node = currentNode();
  if (!node) return;
  logDebug('choice.select', { label: resolved.label, nextNode: resolved.next_node });
  state.path.push({ id: node.id, headline: node.headline, text: node.text, question: node.question, choice: resolved.label, is_ending: !!node.is_ending });
  await speakNodeSequence(node);
}
export async function replayQuestion() { const node = currentNode(); if (node?.question) { logDebug('question.replay', { nodeId: node.id }); await speak(node.question); } }
export function pauseAudio() { stopSpeak(); }
export async function handleVoiceChoice() {
  const node = currentNode();
  if (!node) return;
  const ok = await checkInternet(true);
  syncVoiceButton();
  if (!ok) return;
  document.getElementById('current-question').textContent = 'Je t’écoute…';
  const transcript = await listenOnce();
  logDebug('voice.transcript', { transcript });
  if (!transcript) {
    document.getElementById('current-question').textContent = node.question || 'Que choisis-tu ?';
    await speak(node.question || 'Que choisis-tu ?');
    return;
  }
  const result = await weaveChoice({ story: state.currentStory, node, transcript });
  document.getElementById('current-question').textContent = node.question || 'Que choisis-tu ?';
  syncVoiceButton();
  if (result?.matchedChoice) return chooseOption(result.matchedChoice);
}
export async function playLibraryAdventure(adventure) {
  stopSpeak();
  setView('view-reader');
  document.getElementById('reader-story-title').textContent = adventure.title || 'Aventure';
  document.getElementById('reader-node-title').textContent = 'Mode bibliothèque';
  document.getElementById('reader-cover-emoji').textContent = '📚';
  document.getElementById('question-panel').classList.add('hidden');
  document.getElementById('choices-grid').classList.add('hidden');
  logDebug('library.play', { title: adventure.title, steps: (adventure.nodes || []).length });
  for (const step of adventure.nodes || []) {
    document.getElementById('reader-node-title').textContent = step.headline || adventure.title || 'Aventure';
    await speak(step.text || '');
  }
}
