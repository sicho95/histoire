import { bootstrapStories } from './storage/database.js';
import { state } from './core/state.js';
import { renderHome } from './ui/carousel.js';
import { renderLibrary } from './ui/library.js';
import { renderParental } from './ui/parental.js';
import { handleVoiceChoice, pauseAudio } from './core/engine.js';
import { primeTts } from './audio/tts.js';

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.register('./service-worker.js');
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  reg.addEventListener('updatefound', () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        window.location.reload();
      }
    });
  });
  reg.update().catch(() => {});
}

async function init() {
  await registerSW();
  state.stories = await bootstrapStories();
  renderHome();
  document.getElementById('btn-library').onclick = () => renderLibrary();
  document.getElementById('btn-parental').onclick = () => renderParental();
  document.getElementById('btn-speak').onclick = async () => { await primeTts(); await handleVoiceChoice(); };
  document.getElementById('btn-back-home').onclick = () => window.dispatchEvent(new Event('app:goHome'));
  const syncOffline = () => {
    state.isOffline = !navigator.onLine;
    document.getElementById('btn-speak').style.display = state.isOffline ? 'none' : 'inline-flex';
  };
  window.addEventListener('online', async () => { syncOffline(); state.stories = await bootstrapStories(); renderHome(); });
  window.addEventListener('offline', syncOffline);
  window.addEventListener('app:goHome', () => { pauseAudio(); renderHome(); });
  document.body.addEventListener('pointerdown', () => primeTts(), { once: true });
  syncOffline();
}
init();
