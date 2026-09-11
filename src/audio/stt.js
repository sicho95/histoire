import { prepareMicrophoneAudioSession, restorePlaybackAudioSession } from './audio-session.js';

let activeRecognition = null;

export function stopListening({ restoreAudio = true } = {}) {
  const recognition = activeRecognition;
  activeRecognition = null;
  if (!recognition) return;
  recognition.cancelledByApp = true;
  try { recognition.abort(); } catch {}
  if (restoreAudio) void restorePlaybackAudioSession();
}

export async function listenOnce({ noSpeechMs = 4500, silenceMs = 900, maxMs = 15000 } = {}) {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;
  stopListening({ restoreAudio: false });

  return new Promise(resolve => {
    const recognition = new Ctor();
    activeRecognition = recognition;
    recognition.lang = 'fr-FR';
    recognition.maxAlternatives = 1;
    recognition.interimResults = true;
    recognition.continuous = false;

    let done = false;
    let heardSpeech = false;
    let transcript = '';
    let noSpeechTimer;
    let silenceTimer;
    let hardTimer;
    let endFallback;

    const clearTimers = () => {
      clearTimeout(noSpeechTimer);
      clearTimeout(silenceTimer);
      clearTimeout(hardTimer);
      clearTimeout(endFallback);
    };
    const finish = () => {
      if (done) return;
      done = true;
      clearTimers();
      if (activeRecognition === recognition) activeRecognition = null;
      void restorePlaybackAudioSession();
      resolve(transcript.trim() || null);
    };
    const endCapture = (abort = false) => {
      if (done) return;
      try { abort ? recognition.abort() : recognition.stop(); }
      catch { finish(); return; }
      endFallback = setTimeout(finish, 700);
    };
    const waitForSilence = () => {
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => endCapture(false), silenceMs);
    };

    recognition.onstart = () => {
      noSpeechTimer = setTimeout(() => endCapture(true), noSpeechMs);
    };
    recognition.onspeechstart = () => {
      heardSpeech = true;
      clearTimeout(noSpeechTimer);
      waitForSilence();
    };
    recognition.onspeechend = waitForSilence;
    recognition.onsoundend = () => { if (heardSpeech) waitForSilence(); };
    recognition.onresult = event => {
      const parts = [];
      let finalResult = false;
      for (let index = 0; index < (event.results?.length || 0); index += 1) {
        const result = event.results[index];
        const value = result?.[0]?.transcript?.trim();
        if (value) parts.push(value);
        if (result?.isFinal) finalResult = true;
      }
      if (parts.length) {
        heardSpeech = true;
        transcript = parts.join(' ');
        clearTimeout(noSpeechTimer);
        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => endCapture(false), finalResult ? 250 : silenceMs);
      }
    };
    recognition.onerror = event => {
      if (recognition.cancelledByApp || !['aborted', 'no-speech'].includes(event.error)) transcript = '';
      finish();
    };
    recognition.onend = finish;

    hardTimer = setTimeout(() => endCapture(true), maxMs);
    prepareMicrophoneAudioSession();
    try { recognition.start(); }
    catch { finish(); }
  });
}
