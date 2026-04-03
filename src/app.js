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
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!refreshing) { refreshing = true; location.reload(); } });
  reg.update().catch(() => {});
}
async function init() {
  await registerSW();
  state.stories = await bootstrapStories();
  renderHome();
  document.getElementById('btn-library').onclick = () => renderLibrary();
  document.getElementById('btn-parental').onclick = () => renderParental();
  document.getElementById('btn-speak').onclick = () => { primeTts(); handleVoiceChoice(); };
  window.addEventListener('app:goHome', async () => { pauseAudio(); state.stories = await bootstrapStories(); renderHome(); });
  window.addEventListener('online', async () => { state.isOffline = false; state.stories = await bootstrapStories(); renderHome(); document.getElementById('btn-speak').style.display = 'inline-flex'; });
  window.addEventListener('offline', () => { state.isOffline = true; document.getElementById('btn-speak').style.display = 'none'; });
  document.body.addEventListener('pointerdown', () => primeTts(), { once: true });
  if (!navigator.onLine) document.getElementById('btn-speak').style.display = 'none';
}
init();
