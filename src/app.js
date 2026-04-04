import { bootstrapStories } from './storage/database.js';
import { state } from './core/state.js';
import { renderHome } from './ui/carousel.js';
import { renderLibrary } from './ui/library.js';
import { renderParental } from './ui/parental.js';
import { handleVoiceChoice, pauseAudio, refreshFreeChoiceAvailability } from './core/engine.js';
import { primeTts } from './audio/tts.js';
import { logDebug } from './core/debug.js';
import { onNetworkStateChange, startNetworkWatcher } from './core/network.js';
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.register('./service-worker.js');
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!refreshing) { refreshing = true; location.reload(); } });
  reg.update().catch(() => {});
}
async function init() {
  window.addEventListener('error', event => logDebug('window.error', { message: event.message, source: event.filename, lineno: event.lineno, colno: event.colno }));
  window.addEventListener('unhandledrejection', event => logDebug('window.unhandledrejection', { reason: String(event.reason) }));
  await registerSW();
  state.stories = await bootstrapStories();
  startNetworkWatcher();
  onNetworkStateChange(({ internetReachable }) => {
    logDebug('network.state', { internetReachable });
    refreshFreeChoiceAvailability();
  });
  logDebug('app.init', { stories: state.stories.length, online: navigator.onLine });
  renderHome();
  document.getElementById('btn-library').onclick = () => renderLibrary();
  document.getElementById('btn-parental').onclick = () => renderParental();
  document.getElementById('btn-speak').onclick = () => { primeTts(); handleVoiceChoice(); };
  window.addEventListener('app:goHome', async () => { pauseAudio(); state.stories = await bootstrapStories(); renderHome(); logDebug('app.home', { stories: state.stories.length }); });
  document.body.addEventListener('pointerdown', () => primeTts(), { once: true });
}
init();
