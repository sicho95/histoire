import { bootstrapStories, syncPublishedStories } from './storage/database.js';
import { state, setView } from './core/state.js';
import { continueQuietReading, handleVoiceChoice, pauseAudio, refreshNarrationMode, replayCurrentNode, replayQuestion, startStory } from './core/engine.js';
import { renderHome } from './ui/carousel.js';
import { refreshCreationAvailability, renderLibrary } from './ui/library.js';
import { initParental, openParental, renderParental } from './ui/parental.js';
import { initWizard } from './ui/wizard.js';
import { showToast } from './ui/toast.js';
import { initPwaUpdates } from './pwa/update.js';
import { onNetworkStateChange, startNetworkWatcher } from './core/network.js';
import { getSecrets, getSettings, saveSettings } from './storage/settings.js';
import { toggleReaderPassage } from './ui/reader.js';

function goHome() { pauseAudio(); setView('view-home'); renderHome(); }

function applyTheme(theme = getSettings().theme || 'auto') {
  const allowed = ['auto', 'light', 'dark'];
  const value = allowed.includes(theme) ? theme : 'auto';
  document.documentElement.dataset.theme = value;
  const button = document.getElementById('theme-toggle');
  const labels = { auto: ['◐', 'Thème automatique'], light: ['☀️', 'Thème clair'], dark: ['🌙', 'Thème sombre'] };
  button.textContent = labels[value][0];
  button.title = labels[value][1];
  button.setAttribute('aria-label', `${labels[value][1]}. Toucher pour changer.`);
}

function initNavigation() {
  document.getElementById('home-logo').onclick = goHome;
  document.getElementById('theme-toggle').onclick = () => {
    const settings = getSettings();
    const next = { auto: 'light', light: 'dark', dark: 'auto' }[settings.theme || 'auto'];
    saveSettings({ ...settings, theme: next });
    applyTheme(next);
  };
  document.querySelectorAll('.back-home').forEach(button => { button.onclick = goHome; });
  document.querySelectorAll('.bottom-nav button').forEach(button => {
    button.onclick = async () => {
      const view = button.dataset.view;
      if (view === 'view-parents') return openParental();
      setView(view);
      if (view === 'view-library') await renderLibrary();
      if (view === 'view-parents') renderParental();
    };
  });
  document.getElementById('start-studio').onclick = () => {
    if (getSecrets().groqApiKey) setView('view-studio');
  };
  document.getElementById('reader-close').onclick = goHome;
  document.getElementById('reader-audio').onclick = () => state.isNarrating ? pauseAudio() : replayCurrentNode();
  document.getElementById('reader-mode').onclick = async () => {
    const settings = getSettings();
    const quietMode = !settings.quietMode;
    saveSettings({ ...settings, quietMode });
    showToast(quietMode ? 'Mode discret : lis et avance à ton rythme.' : 'Narration vocale réactivée.');
    await refreshNarrationMode();
  };
  document.getElementById('reader-continue').onclick = continueQuietReading;
  document.getElementById('replay-question').onclick = replayQuestion;
  document.getElementById('toggle-passage').onclick = toggleReaderPassage;
  document.getElementById('speak-choice').onclick = handleVoiceChoice;
  document.getElementById('restart-story').onclick = () => startStory(state.currentStory);
  document.getElementById('end-home').onclick = goHome;
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
  applyTheme();
  initNavigation();
  initParental();
  initWizard();
  refreshCreationAvailability();
  window.addEventListener('app:secretsChanged', refreshCreationAvailability);
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
