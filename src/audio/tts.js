let activeResolve = null;
export function stopSpeak() {
  window.speechSynthesis?.cancel();
  if (activeResolve) { activeResolve(); activeResolve = null; }
}
export function speak(text, opts = {}) {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window) || !text) return resolve();
    stopSpeak();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = opts.rate || 0.95;
    u.pitch = opts.pitch || 1;
    u.onend = () => { activeResolve = null; resolve(); };
    u.onerror = () => { activeResolve = null; resolve(); };
    activeResolve = resolve;
    const run = () => window.speechSynthesis.speak(u);
    if (speechSynthesis.getVoices().length) run();
    else speechSynthesis.onvoiceschanged = run;
  });
}
