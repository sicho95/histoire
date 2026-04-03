import { speak, stopSpeak } from '../audio/tts.js';
import { listenOnce } from '../audio/stt.js';
import { currentNode, state, setView } from './state.js';
import { renderReader } from '../ui/reader.js';
import { renderEndScreen } from '../ui/end_screen.js';
import { weaveChoice } from './weaver.js';
let introTimer = null;
export async function startStoryFromCarousel(story) {
  stopSpeak();
  state.currentStory = story;
  state.currentNodeId = story.start_node || 'start';
  state.path = [];
  renderReader({ introOnly: true });
  clearTimeout(introTimer);
  const node = currentNode();
  await speak(`${story.title}. ${story.intro || 'Installe-toi bien, l\'histoire commence.'}`);
  renderReader({ introOnly: true });
  await speak(node.text || '');
  state.path.push({ id: node.id, text: node.text, question: node.question });
  showQuestionAndChoices();
}
export async function showQuestionAndChoices() {
  renderReader();
  const node = currentNode();
  if (!node) return;
  if (node.is_ending) return renderEndScreen();
  if (node.question) await speak(node.question);
}
export async function chooseOption(choice) {
  stopSpeak();
  const node = currentNode();
  choice.play_count = (choice.play_count || 0) + 1;
  state.currentNodeId = choice.next_node;
  const next = currentNode();
  if (!next) return;
  renderReader({ introOnly: true });
  await speak(`${choice.label}. ${next.text}`);
  state.path.push({ id: next.id, text: next.text, question: next.question, choice: choice.label });
  if (next.is_ending) return renderEndScreen();
  showQuestionAndChoices();
}
export async function replayStory() {
  const node = currentNode();
  if (!node) return;
  await speak(node.text || '');
}
export async function replayQuestion() {
  const node = currentNode();
  if (node?.question) await speak(node.question);
}
export const speakQuestionOnly = replayQuestion;
export async function handleVoiceChoice() {
  const node = currentNode();
  if (!node || !navigator.onLine) return;
  document.getElementById('current-question').textContent = 'Je t’écoute…';
  const transcript = await listenOnce();
  if (!transcript) {
    document.getElementById('current-question').textContent = node.question;
    await speak('Je n’ai pas bien entendu. Tu peux toucher un bouton.');
    return;
  }
  const result = await weaveChoice({ story: state.currentStory, node, transcript });
  if (result.matchedChoice) return chooseOption(result.matchedChoice);
  document.getElementById('current-question').textContent = node.question;
  await speak('Je n’ai pas trouvé. Tu peux choisir avec les tuiles.');
}
window.addEventListener('app:goHome', () => { stopSpeak(); setView('view-home'); });
