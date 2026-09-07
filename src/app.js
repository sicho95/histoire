import { bootstrapStories, syncPublishedStories } from './storage/database.js';
import { state, setView } from './core/state.js';
import { handleVoiceChoice, pauseAudio, replayCurrentNode, saveCurrentAdventure, startStory } from './core/engine.js';
import { renderHome } from './ui/carousel.js';
import { renderLibrary } from './ui/library.js';
import { initParental, renderParental } from './ui/parental.js';
import { initWizard } from './ui/wizard.js';
import { showToast } from './ui/toast.js';
import { initPwaUpdates } from './pwa/update.js';
import { onNetworkStateChange, startNetworkWatcher } from './core/network.js';

function goHome() { pauseAudio(); setView('view-home'); renderHome(); }

function initNavigation() {
  document.getElementById('home-logo').onclick = goHome;
  document.getElementById('open-parents').onclick = () => { setView('view-parents'); renderParental(); };
  document.querySelectorAll('.back-home').forEach(button => { button.onclick = goHome; });
  document.querySelectorAll('.bottom-nav button').forEach(button => {
    button.onclick = async () => {
      const view = button.dataset.view;
      setView(view);
      if (view === 'view-library') await renderLibrary();
      if (view === 'view-parents') renderParental();
    };
  });
  document.getElementById('start-studio').onclick = () => setView('view-studio');
  document.getElementById('reader-close').onclick = goHome;
  document.getElementById('reader-audio').onclick = () => state.isNarrating ? pauseAudio() : replayCurrentNode();
  document.getElementById('speak-choice').onclick = handleVoiceChoice;
  document.getElementById('restart-story').onclick = () => startStory(state.currentStory);
  document.getElementById('end-home').onclick = goHome;
  document.getElementById('save-adventure').onclick = async () => { await saveCurrentAdventure(); showToast('Ce parcours est gardé sur cet appareil.'); };
  document.getElementById('sync-stories').onclick = async event => {
    event.currentTarget.disabled = true;
    try {
      const result = await syncPublishedStories({ force: true });
      state.stories = await bootstrapStories();
      renderHome();
      showToast(result.synced.length ? `${result.synced.length} histoire(s) mise(s) à jour.` : 'La bibliothèque est déjà à jour.');
    } catch (error) { showToast(error.message); }
    finally { event.currentTarget.disabled = false; }
  };
}

async function init() {
  initNavigation();
  initParental();
  initWizard();
  state.stories = await bootstrapStories();
  renderHome();
  onNetworkStateChange(({ internetReachable }) => {
    document.getElementById('offline-pill').classList.toggle('hidden', internetReachable);
  });
  document.getElementById('offline-pill').classList.toggle('hidden', navigator.onLine);
  startNetworkWatcher();
  document.body.addEventListener('pointerdown', () => window.speechSynthesis?.getVoices(), { once: true });
  initPwaUpdates().catch(() => {});
}

init().catch(error => showToast(`L’application n’a pas pu démarrer : ${error.message}`));
