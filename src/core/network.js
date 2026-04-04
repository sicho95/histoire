import { logDebug } from './debug.js';
const state = {
  internetReachable: navigator.onLine,
  lastCheckAt: 0,
  intervalId: null
};
const listeners = new Set();
async function ping(url, timeoutMs = 3500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store', signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
function notify() {
  for (const listener of listeners) {
    try { listener({ ...state }); } catch {}
  }
}
export function onNetworkStateChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getNetworkState() { return { ...state }; }
export async function checkInternet(force = false) {
  const now = Date.now();
  if (!force && now - state.lastCheckAt < 5000) return state.internetReachable;
  state.lastCheckAt = now;
  if (!navigator.onLine) {
    if (state.internetReachable !== false) logDebug('network.check', { mode: 'navigatorOffline' });
    state.internetReachable = false;
    notify();
    return false;
  }
  const urls = ['./manifest.json', './assets/default_stories.json'];
  let ok = false;
  for (const url of urls) {
    ok = await ping(`${url}?t=${Date.now()}`);
    if (ok) break;
  }
  state.internetReachable = ok;
  logDebug('network.check', { ok, online: navigator.onLine, time: now });
  notify();
  return ok;
}
export function shouldAllowFreeChoice() { return !!state.internetReachable; }
export function startNetworkWatcher() {
  if (state.intervalId) return;
  const refresh = () => checkInternet(true).catch(() => {});
  state.intervalId = setInterval(refresh, 25000);
  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
  refresh();
}
