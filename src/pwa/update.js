const CURRENT_BUILD = '6c5ee0e9869e53250ceb5ac45ce64943b302c98c-8';
let registration;
let reloading = false;

function showUpdate() {
  document.getElementById('update-banner')?.classList.remove('hidden');
}

function watchInstalling(worker) {
  worker?.addEventListener('statechange', () => {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate();
  });
}

async function checkVersion() {
  try {
    const version = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' }).then(response => response.json());
    if (version.buildId && version.buildId !== CURRENT_BUILD) {
      await registration?.update();
      if (registration?.waiting) showUpdate();
    }
  } catch {}
}

export async function initPwaUpdates() {
  if (!('serviceWorker' in navigator)) return;
  registration = await navigator.serviceWorker.register('./service-worker.js');
  if (registration.waiting) showUpdate();
  if (registration.installing) watchInstalling(registration.installing);
  registration.addEventListener('updatefound', () => watchInstalling(registration.installing));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  document.getElementById('apply-update').onclick = () => registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkVersion(); });
  window.addEventListener('focus', checkVersion);
  setInterval(checkVersion, 60_000);
  checkVersion();
}
