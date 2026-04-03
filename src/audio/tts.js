let activeResolve = null;
let primed = false;
export function stopSpeak() { try { speechSynthesis.cancel(); } catch {} if (activeResolve) { activeResolve(); activeResolve = null; } }
export function primeTts() {
  if (!('speechSynthesis' in window) || primed) return;
  primed = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    setTimeout(() => speechSynthesis.cancel(), 30);
  } catch {}
}
export function speak(text, opts = {}) {
  return new Promise(resolve => {
    if (!text || !('speechSynthesis' in window)) return resolve();
    stopSpeak();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = 'fr-FR';
    u.rate = opts.rate || 0.96;
    u.pitch = opts.pitch || 1;
    const voices = speechSynthesis.getVoices();
    const fr = voices.find(v => /^fr/i.test(v.lang));
    if (fr) u.voice = fr;
    u.onend = () => { activeResolve = null; resolve(); };
    u.onerror = () => { activeResolve = null; resolve(); };
    activeResolve = resolve;
    try { speechSynthesis.resume?.(); speechSynthesis.speak(u); } catch { activeResolve = null; resolve(); }
  });
}
