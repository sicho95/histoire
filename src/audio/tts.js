import { getSettings } from '../storage/settings.js';
import { logDebug } from '../core/debug.js';
import { getAudioCacheEntry, putAudioCacheEntry } from '../storage/audio_cache.js';
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
function hashText(value) {
  let h = 2166136261;
  for (const ch of String(value)) {
    h ^= ch.charCodeAt(0);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(36);
}
function cacheId(provider, voice, text) { return `${provider}::${voice || 'default'}::${hashText(text)}`; }
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(',');
  const mime = /data:(.*?);base64/.exec(meta)?.[1] || 'audio/mpeg';
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}
async function getCachedBlob(provider, voice, text) {
  const id = cacheId(provider, voice, text);
  const entry = await getAudioCacheEntry(id);
  if (!entry?.dataUrl) return null;
  logDebug('tts.cache.hit', { id, provider, voice });
  return dataUrlToBlob(entry.dataUrl);
}
async function saveCachedBlob(provider, voice, text, blob) {
  const id = cacheId(provider, voice, text);
  await putAudioCacheEntry({ id, provider, voice, textHash: hashText(text), textPreview: String(text).slice(0, 120), dataUrl: await blobToDataUrl(blob), createdAt: Date.now() });
  logDebug('tts.cache.store', { id, provider, voice, size: blob.size });
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
  return voices.find(v => /^fr/i.test(v.lang) && /google|premium|samantha|audrey|amelie|hortense|thomas|super/i.test(v.name)) || voices.find(v => /^fr/i.test(v.lang)) || null;
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
async function fetchOpenAiBlob(text, settings) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.ttsApiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: settings.ttsVoice || 'nova', input: text, format: 'mp3' })
  });
  if (!res.ok) throw new Error(`openai_tts_${res.status}`);
  return res.blob();
}
async function fetchElevenBlob(text, settings) {
  const voiceId = settings.ttsVoice || '';
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': settings.ttsApiKey, Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.45, similarity_boost: 0.8 } })
  });
  if (!res.ok) throw new Error(`elevenlabs_tts_${res.status}`);
  return res.blob();
}
export async function warmTtsCache(texts = []) {
  const settings = getSettings();
  if (settings.ttsProvider === 'browser' || !settings.ttsApiKey) return { stored: 0, skipped: texts.length };
  let stored = 0;
  let skipped = 0;
  for (const text of texts.filter(Boolean)) {
    const cached = await getCachedBlob(settings.ttsProvider, settings.ttsVoice, text);
    if (cached) { skipped += 1; continue; }
    try {
      const blob = settings.ttsProvider === 'openai' ? await fetchOpenAiBlob(text, settings) : await fetchElevenBlob(text, settings);
      await saveCachedBlob(settings.ttsProvider, settings.ttsVoice, text, blob);
      stored += 1;
    } catch (error) {
      logDebug('tts.cache.warm.error', { provider: settings.ttsProvider, message: String(error), textPreview: String(text).slice(0, 120) });
    }
  }
  return { stored, skipped };
}
export async function speak(text) {
  const settings = getSettings();
  if (!text) return;
  try {
    if (settings.ttsProvider === 'openai' || settings.ttsProvider === 'elevenlabs') {
      if (settings.ttsApiKey) {
        const cached = await getCachedBlob(settings.ttsProvider, settings.ttsVoice, text);
        if (cached) return playBlob(cached, { provider: settings.ttsProvider, voice: settings.ttsVoice, cached: true, textPreview: String(text).slice(0, 240) });
        const blob = settings.ttsProvider === 'openai' ? await fetchOpenAiBlob(text, settings) : await fetchElevenBlob(text, settings);
        await saveCachedBlob(settings.ttsProvider, settings.ttsVoice, text, blob);
        return playBlob(blob, { provider: settings.ttsProvider, voice: settings.ttsVoice, cached: false, textPreview: String(text).slice(0, 240) });
      }
    }
  } catch (error) {
    logDebug('tts.remote.error', { provider: settings.ttsProvider, message: String(error) });
  }
  return speakBrowser(text);
}
