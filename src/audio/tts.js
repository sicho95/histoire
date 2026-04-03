
export const speak = (text, onEnd) => {
    if (!('speechSynthesis' in window)) return onEnd?.();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR'; u.rate = 0.9;
    u.onend = () => onEnd?.();
    speechSynthesis.speak(u);
};
export const stopSpeak = () => window.speechSynthesis?.cancel();
