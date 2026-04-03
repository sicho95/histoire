let activeResolve = null;
let warmed = false;
export function stopSpeak() {
  try { window.speechSynthesis?.cancel(); } catch {}
  if (activeResolve) { activeResolve(); activeResolve = null; }
}
export async function primeTts() {
  if (!('speechSynthesis' in window) || warmed) return;
  warmed = true;
  try {
    const ghost = new SpeechSynthesisUtterance(' ');
    ghost.volume = 0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(ghost);
    window.speechSynthesis.cancel();
  } catch {}
}
function waitVoices() {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window)) return resolve();
    if (speechSynthesis.getVoices().length) return resolve();
    const done = () => { speechSynthesis.removeEventListener?.('voiceschanged', done); resolve(); };
    try { speechSynthesis.addEventListener('voiceschanged', done, { once: true }); } catch { speechSynthesis.onvoiceschanged = done; }
    setTimeout(resolve, 400);
  });
}
export async function speak(text, opts = {}) {
  if (!text || !('speechSynthesis' in window)) return;
  await waitVoices();
  return new Promise(resolve => {
    stopSpeak();
    const utter = new SpeechSynthesisUtterance(String(text));
    utter.lang = 'fr-FR';
    utter.rate = opts.rate || 0.94;
    utter.pitch = opts.pitch || 1;
    utter.volume = 1;
    const voices = speechSynthesis.getVoices();
    const fr = voices.find(v => /^fr/i.test(v.lang));
    if (fr) utter.voice = fr;
    utter.onend = () => { activeResolve = null; resolve(); };
    utter.onerror = () => { activeResolve = null; resolve(); };
    activeResolve = resolve;
    try {
      speechSynthesis.cancel();
      speechSynthesis.resume?.();
      speechSynthesis.speak(utter);
      setTimeout(() => speechSynthesis.resume?.(), 60);
    } catch {
      activeResolve = null;
      resolve();
    }
  });
}
