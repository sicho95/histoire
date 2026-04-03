import { saveToLibrary } from '../storage/database.js';
import { state, setView } from '../core/state.js';
import { speak } from '../audio/tts.js';
import { renderHome } from './carousel.js';
export function renderEndScreen() {
  setView('view-end');
  speak('Bravo ! Cette aventure est terminée.');
  document.getElementById('btn-save-adventure').onclick = async () => {
    const texts = state.path.map(step => step.text).filter(Boolean);
    await saveToLibrary({ title: state.currentStory.title, summary: texts.slice(0, 4).join(' ').slice(0, 260), nodes: state.path, savedAt: Date.now() });
    renderHome();
    setView('view-home');
  };
  document.getElementById('btn-end-home').onclick = () => { renderHome(); setView('view-home'); };
}
