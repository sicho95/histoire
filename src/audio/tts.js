import { getSettings, getSecrets } from '../storage/settings.js';
import { logDebug } from '../core/debug.js';
import { getAudioCacheEntry, getStaticAudio, putAudioCacheEntry } from '../storage/audio_cache.js';

let currentAudio = null;
let currentUtterance = null;
let activeResolve = null;

export function hashText(text) {
  let hash = 2166136261;
  for (const char of String(text || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function cacheId(settings, text, context) {
  return [
    settings.ttsProvider,
    settings.openaiTtsModel,
    settings.openaiVoice,
    settings.narrationStyle,
    context?.narration?.mood || 'neutral',
    hashText(text)
  ].join('::');
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const [metadata, encoded] = dataUrl.split(',');
  const type = /data:(.*?);base64/.exec(metadata)?.[1] || 'audio/mpeg';
  return new Blob([Uint8Array.from(atob(encoded), char => char.charCodeAt(0))], { type });
}

function narrationInstructions(context = {}) {
  const moods = {
    wonder: 'avec émerveillement et curiosité', joy: 'avec une joie lumineuse', mystery: 'avec mystère et douceur',
    suspense: 'avec un suspense marqué mais adapté à un enfant', gentle_fear: 'avec une petite peur rassurante, jamais terrifiante',
    sadness: 'avec une émotion tendre', calm: 'avec calme et chaleur', triumph: 'avec fierté et enthousiasme'
  };
  const pace = { slow: 'un rythme lent', normal: 'un rythme naturel', lively: 'un rythme vivant' };
  const narration = context.narration || {};
  const role = context.heroVoice === 'male' ? 'un conteur chaleureux' : 'une conteuse chaleureuse';
  return `Raconte en français comme ${role} pour enfants, ${moods[narration.mood] || moods.wonder}, avec ${pace[narration.pace] || pace.normal}. Marque les surprises, les dialogues et les silences avec naturel. Ne surjoue pas et ne rends jamais la scène terrifiante.`;
}

function splitText(text, limit = 3900) {
  const paragraphs = String(text).split(/(?<=[.!?…])\s+/);
  const chunks = [];
  let chunk = '';
  for (const part of paragraphs) {
    if (chunk && `${chunk} ${part}`.length > limit) { chunks.push(chunk); chunk = part; }
    else chunk = chunk ? `${chunk} ${part}` : part;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

async function fetchOpenAi(text, context) {
  const settings = getSettings();
  const apiKey = getSecrets().openaiApiKey;
  if (!apiKey) throw new Error('Ajoute la clé OpenAI dans l’espace Parents.');
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: settings.openaiTtsModel || 'gpt-4o-mini-tts',
      voice: settings.openaiVoice || 'marin',
      input: text,
      instructions: narrationInstructions(context),
      response_format: 'mp3'
    })
  });
  if (!response.ok) throw new Error(`La narration OpenAI a échoué (${response.status}).`);
  return response.blob();
}

function playBlob(blob, meta = {}) {
  return new Promise(resolve => {
    stopSpeak();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    activeResolve = resolve;
    const finish = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      activeResolve = null;
      resolve();
    };
    audio.onended = finish;
    audio.onerror = finish;
    logDebug('tts.play', meta);
    audio.play().catch(finish);
  });
}

function preferredFrenchVoice(heroVoice = 'female') {
  const voices = speechSynthesis.getVoices().filter(voice => /^fr/i.test(voice.lang));
  const genderPattern = heroVoice === 'male' ? /thomas|jacques|henri|nicolas/i : /flo|audrey|am[eé]lie|aurelie|virginie/i;
  return voices.find(voice => genderPattern.test(voice.name)) || voices.find(voice => /premium|enhanced|google/i.test(voice.name)) || voices[0] || null;
}

function speakBrowser(text, context = {}) {
  return new Promise(resolve => {
    if (!text || !('speechSynthesis' in window)) return resolve();
    stopSpeak();
    const mood = context.narration?.mood;
    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.lang = 'fr-FR';
    utterance.rate = context.narration?.pace === 'slow' ? 0.86 : context.narration?.pace === 'lively' ? 1.02 : getSettings().speechRate;
    utterance.pitch = ['joy', 'wonder', 'triumph'].includes(mood) ? 1.08 : ['suspense', 'gentle_fear'].includes(mood) ? 0.94 : 1;
    const voice = preferredFrenchVoice(context.heroVoice);
    if (voice) utterance.voice = voice;
    currentUtterance = utterance;
    activeResolve = resolve;
    const finish = () => { currentUtterance = null; activeResolve = null; resolve(); };
    utterance.onend = finish;
    utterance.onerror = finish;
    speechSynthesis.speak(utterance);
  });
}

export function stopSpeak() {
  try { window.speechSynthesis?.cancel(); } catch {}
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  currentUtterance = null;
  const resolve = activeResolve;
  activeResolve = null;
  resolve?.();
}

export function primeTts() {
  try { window.speechSynthesis?.getVoices(); } catch {}
}

export async function speak(text, context = {}) {
  if (!text) return;
  const settings = getSettings();
  const textHash = hashText(text);
  const staticAudio = await getStaticAudio({ storyId: context.storyId, nodeId: context.nodeId, textHash });
  if (staticAudio) return playBlob(staticAudio, { source: 'editorial', ...context });

  if (settings.ttsProvider === 'openai' && getSecrets().openaiApiKey) {
    const id = cacheId(settings, text, context);
    try {
      const cached = await getAudioCacheEntry(id);
      if (cached?.dataUrl) return playBlob(dataUrlToBlob(cached.dataUrl), { source: 'cache', id });
      const blobs = [];
      for (const chunk of splitText(text)) blobs.push(await fetchOpenAi(chunk, context));
      const blob = new Blob(blobs, { type: 'audio/mpeg' });
      await putAudioCacheEntry({ id, dataUrl: await blobToDataUrl(blob), createdAt: Date.now(), textHash });
      return playBlob(blob, { source: 'openai', id });
    } catch (error) {
      logDebug('tts.openai.fallback', { message: error.message });
    }
  }
  return speakBrowser(text, context);
}

export async function warmTtsCache(items = []) {
  let stored = 0;
  for (const item of items) {
    const text = typeof item === 'string' ? item : item.text;
    const context = typeof item === 'string' ? {} : item;
    await speak(text, context);
    stored += 1;
  }
  return { stored, skipped: 0 };
}
