
export const listen = (onResult, onError) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return onError('Non supporté');
    const r = new SR();
    r.lang = 'fr-FR';
    r.onresult = e => onResult(e.results[0][0].transcript);
    r.onerror = e => onError(e.error);
    r.start();
};
