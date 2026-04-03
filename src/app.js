import { bootstrapStories } from './storage/database.js';
import { state, setView } from './core/state.js';
import { renderHome } from './ui/carousel.js';
import { renderLibrary } from './ui/library.js';
import { renderParental } from './ui/parental.js';
import { handleVoiceChoice } from './core/engine.js';
async function init() {
  state.stories = await bootstrapStories();
  renderHome();
  setView('view-home');
  document.getElementById('btn-library').onclick = () => renderLibrary();
  document.getElementById('btn-parental').onclick = () => renderParental();
  document.getElementById('btn-speak').onclick = () => handleVoiceChoice();
  const syncOffline = () => {
    state.isOffline = !navigator.onLine;
    document.getElementById('btn-speak').style.display = state.isOffline ? 'none' : 'inline-flex';
    document.getElementById('home-hint').textContent = state.isOffline ? 'Mode hors ligne : les choix tactiles restent disponibles.' : 'Touchez une pochette pour écouter le titre puis démarrer l\'histoire.';
  };
  window.addEventListener('online', syncOffline);
  window.addEventListener('offline', syncOffline);
  syncOffline();
}
init();
