import { speak, stopSpeak, primeTts } from '../audio/tts.js';
import { listenOnce } from '../audio/stt.js';
import { currentNode, state, setView } from './state.js';
import { renderReader } from '../ui/reader.js';
import { renderEndScreen } from '../ui/end_screen.js';
import { weaveChoice } from './weaver.js';
function randomExistingChoice() {
  const node = currentNode();
  const choices = (node?.choices || []).filter(c => !c.__random);
  return choices[Math.floor(Math.random() * choices.length)];
}
async function speakNodeSequence(node) {
  if (!node) return;
  renderReader({ mode: 'cover' });
  await speak(node.text || '');
  if (node.is_ending) return renderEndScreen();
  renderReader({ mode: 'question' });
  if (node.question) await speak(node.question);
}
export function startStoryFromCarousel(story) {
  primeTts();
  stopSpeak();
  state.currentStory = story;
  state.currentNodeId = story.start_node || 'start';
  state.path = [];
  renderReader({ mode: 'cover' });
  const node = currentNode();
  state.path.push({ id: node.id, headline: node.headline, text: node.text, question: node.question });
  speak(`${story.title}. ${story.intro || 'Installe-toi bien, l histoire commence.'}`).then(() => speakNodeSequence(node));
}
export async function chooseOption(choice) {
  stopSpeak();
  if (choice?.__random) choice = randomExistingChoice();
  if (!choice) return;
  choice.play_count = (choice.play_count || 0) + 1;
  state.currentNodeId = choice.next_node;
  const node = currentNode();
  if (!node) return;
  state.path.push({ id: node.id, headline: node.headline, text: node.text, question: node.question, choice: choice.label, is_ending: !!node.is_ending });
  await speakNodeSequence(node);
}
export async function replayQuestion() { const node = currentNode(); if (node?.question) await speak(node.question); }
export function pauseAudio() { stopSpeak(); }
export async function handleVoiceChoice() {
  const node = currentNode();
  if (!node || !navigator.onLine) return;
  document.getElementById('current-question').textContent = 'Je t’écoute…';
  const transcript = await listenOnce();
  if (!transcript) { document.getElementById('current-question').textContent = node.question || 'Que choisis-tu ?'; await speak('Je n ai pas bien entendu. Tu peux choisir avec les tuiles.'); return; }
  const result = await weaveChoice({ story: state.currentStory, node, transcript, endingCount: state.path.filter(s => s.is_ending).length });
  document.getElementById('current-question').textContent = node.question || 'Que choisis-tu ?';
  if (result?.matchedChoice) return chooseOption(result.matchedChoice);
  await speak('Je n ai pas trouvé. Tu peux choisir avec les tuiles.');
}
export async function playLibraryAdventure(adventure) {
  stopSpeak();
  setView('view-reader');
  document.getElementById('reader-story-title').textContent = adventure.title || 'Aventure';
  document.getElementById('reader-node-title').textContent = 'Mode bibliothèque';
  document.getElementById('reader-cover-emoji').textContent = '📚';
  document.getElementById('question-panel').classList.add('hidden');
  document.getElementById('choices-grid').classList.add('hidden');
  for (const step of adventure.nodes || []) { document.getElementById('reader-node-title').textContent = step.headline || adventure.title || 'Aventure'; await speak(step.text || ''); }
}
