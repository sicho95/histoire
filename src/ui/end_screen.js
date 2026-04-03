import { saveToLibrary } from '../storage/database.js';
import { state, setView } from '../core/state.js';
import { speak } from '../audio/tts.js';
import { renderHome } from './carousel.js';

export function renderEndScreen() {
  setView('view-end');
  speak('Bravo ! Cette aventure est terminée.');
  document.getElementById('btn-save-adventure').onclick = async () => {
    const summary = (state.path || []).map(step => step.text).filter(Boolean).join(' ').slice(0, 280);
    await saveToLibrary({ title: state.currentStory.title, summary, nodes: state.path, savedAt: Date.now() });
    renderHome();
  };
  document.getElementById('btn-end-home').onclick = () => renderHome();
}
