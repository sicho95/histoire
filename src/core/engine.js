import { speak, stopSpeak, primeTts } from '../audio/tts.js';
import { listenOnce } from '../audio/stt.js';
import { currentNode, state, setView } from './state.js';
import { renderReader } from '../ui/reader.js';
import { renderEndScreen } from '../ui/end_screen.js';
import { weaveChoice } from './weaver.js';

async function speakNodeSequence(node) {
  if (!node) return;
  renderReader({ mode: 'cover' });
  await speak(node.text || '');
  if (node.is_ending) {
    renderEndScreen();
    return;
  }
  renderReader({ mode: 'question' });
  if (node.question) await speak(node.question);
}

export async function startStoryFromCarousel(story) {
  await primeTts();
  stopSpeak();
  state.currentStory = story;
  state.currentNodeId = story.start_node || 'start';
  state.path = [];
  renderReader({ mode: 'cover' });
  await speak(`${story.title}. ${story.intro || 'Installe-toi bien, l histoire commence.'}`);
  const node = currentNode();
  state.path.push({ id: node.id, headline: node.headline, text: node.text, question: node.question });
  await speakNodeSequence(node);
}

export async function chooseOption(choice) {
  stopSpeak();
  choice.play_count = (choice.play_count || 0) + 1;
  state.currentNodeId = choice.next_node;
  const node = currentNode();
  if (!node) return;
  state.path.push({ id: node.id, headline: node.headline, text: node.text, question: node.question, choice: choice.label });
  await speakNodeSequence(node);
}

export async function replayQuestion() {
  const node = currentNode();
  if (node?.question) await speak(node.question);
}

export async function handleVoiceChoice() {
  const node = currentNode();
  if (!node || !navigator.onLine) return;
  document.getElementById('current-question').textContent = 'Je t’écoute…';
  const transcript = await listenOnce();
  if (!transcript) {
    document.getElementById('current-question').textContent = node.question || 'Que choisis-tu ?';
    await speak('Je n ai pas bien entendu. Tu peux choisir avec les tuiles.');
    return;
  }
  const endings = state.path.filter(step => step.is_ending).length;
  const result = await weaveChoice({ story: state.currentStory, node, transcript, endingCount: endings });
  document.getElementById('current-question').textContent = node.question || 'Que choisis-tu ?';
  if (result?.matchedChoice) {
    await chooseOption(result.matchedChoice);
    return;
  }
  await speak('Je n ai pas trouvé. Tu peux choisir avec les tuiles.');
}

export function pauseAudio() {
  stopSpeak();
}

export async function playLibraryAdventure(adventure) {
  stopSpeak();
  setView('view-reader');
  document.getElementById('reader-story-title').textContent = adventure.title || 'Aventure';
  document.getElementById('reader-node-title').textContent = 'Mode bibliothèque';
  document.getElementById('reader-cover-emoji').textContent = '📚';
  document.getElementById('question-panel').classList.add('hidden');
  document.getElementById('choices-grid').classList.add('hidden');
  for (const step of adventure.nodes || []) {
    document.getElementById('reader-node-title').textContent = step.headline || adventure.title || 'Aventure';
    await speak(step.text || '');
  }
}
