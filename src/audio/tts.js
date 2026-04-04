import { getSettings } from '../storage/settings.js';
import { logDebug } from '../core/debug.js';
let activeResolve = null;
let currentAudio = null;
let primed = false;
function settle() { if (activeResolve) { activeResolve(); activeResolve = null; } }
function stopAudioElement() {
  if (currentAudio) {
    try { currentAudio.pause(); currentAudio.src = ''; } catch {}
    currentAudio = null;
  }
}
export function stopSpeak() {
  try { window.speechSynthesis?.cancel(); } catch {}
  stopAudioElement();
  settle();
  logDebug('tts.stop', {});
}
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
function pickFrenchVoice() {
  const voices = speechSynthesis.getVoices();
  return voices.find(v => /^fr/i.test(v.lang) && /google|premium|samantha|audrey|amelie|hortense|thomas|super/i.test(v.name))
    || voices.find(v => /^fr/i.test(v.lang))
    || null;
}
function speakBrowser(text) {
  return new Promise(resolve => {
    if (!text || !('speechSynthesis' in window)) return resolve();
    stopSpeak();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = 'fr-FR';
    u.rate = 0.97;
    u.pitch = 1;
    const voice = pickFrenchVoice();
    if (voice) u.voice = voice;
    logDebug('tts.browser.start', { voice: voice?.name || null, textPreview: String(text).slice(0, 240) });
    u.onend = () => { settle(); resolve(); };
    u.onerror = () => { settle(); resolve(); };
    activeResolve = resolve;
    try { speechSynthesis.resume?.(); speechSynthesis.speak(u); } catch { settle(); resolve(); }
  });
}
async function playBlob(blob, meta) {
  return new Promise(resolve => {
    stopSpeak();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    activeResolve = resolve;
    logDebug('tts.audio.start', meta);
    audio.onended = () => { URL.revokeObjectURL(url); stopAudioElement(); settle(); resolve(); };
    audio.onerror = () => { URL.revokeObjectURL(url); stopAudioElement(); settle(); resolve(); };
    audio.play().catch(() => { URL.revokeObjectURL(url); stopAudioElement(); settle(); resolve(); });
  });
}
async function speakOpenAI(text, settings) {
  if (!settings.ttsApiKey) throw new Error('missing_openai_tts_key');
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.ttsApiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: settings.ttsVoice || 'nova', input: text, format: 'mp3' })
  });
  if (!res.ok) throw new Error(`openai_tts_${res.status}`);
  const blob = await res.blob();
  return playBlob(blob, { provider: 'openai', voice: settings.ttsVoice || 'nova', textPreview: String(text).slice(0, 240) });
}
async function speakElevenLabs(text, settings) {
  const voiceId = settings.ttsVoice || '';
  if (!settings.ttsApiKey || !voiceId) throw new Error('missing_elevenlabs_tts_config');
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': settings.ttsApiKey, Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.45, similarity_boost: 0.8 } })
  });
  if (!res.ok) throw new Error(`elevenlabs_tts_${res.status}`);
  const blob = await res.blob();
  return playBlob(blob, { provider: 'elevenlabs', voice: voiceId, textPreview: String(text).slice(0, 240) });
}
export async function speak(text) {
  const settings = getSettings();
  if (!text) return;
  try {
    if (settings.ttsProvider === 'openai') return await speakOpenAI(text, settings);
    if (settings.ttsProvider === 'elevenlabs') return await speakElevenLabs(text, settings);
  } catch (error) {
    logDebug('tts.remote.error', { provider: settings.ttsProvider, message: String(error) });
  }
  return speakBrowser(text);
}
