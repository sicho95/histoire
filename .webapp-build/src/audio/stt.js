export async function listenOnce() {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Promise(resolve => {
    const rec = new Ctor();
    rec.lang = 'fr-FR';
    rec.maxAlternatives = 1;
    rec.interimResults = false;
    let done = false;
    const finish = value => { if (!done) { done = true; resolve(value); } };
    rec.onresult = e => finish(e.results?.[0]?.[0]?.transcript || null);
    rec.onerror = () => finish(null);
    rec.onend = () => finish(null);
    rec.start();
  });
}
