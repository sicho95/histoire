import { getSettings, getSecrets } from '../storage/settings.js';
import { logDebug } from '../core/debug.js';
import { getAudioCacheEntry, getStaticAudio, putAudioCacheEntry } from '../storage/audio_cache.js';
import { forceFrenchPronunciation, FRENCH_SPEECH_VERSION } from './french-speech.js';

let audioPlayer = null;
let currentAudioUrl = null;
let currentUtterance = null;
let activeResolve = null;
let audioGeneration = 0;
let edgeModulePromise = null;
let edgeRetryAfter = 0;

const EDGE_TTS_MODULE = 'https://cdn.jsdelivr.net/npm/edge-tts-universal@1.4.0/dist/browser.js';

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
    settings.azureSpeechRegion,
    settings.openaiTtsModel,
    ['edge-azure', 'azure'].includes(settings.ttsProvider) ? azureVoice(context) : settings.openaiVoice,
    settings.narrationStyle,
    FRENCH_SPEECH_VERSION,
    context?.narration?.mood || 'neutral',
    hashText(text)
  ].join('::');
}

export function portableAudioId({ storyId, nodeId, textHash }) {
  return `portable::${FRENCH_SPEECH_VERSION}::${storyId}::${nodeId}::${textHash}`;
}

const AZURE_PROFILES = {
  pace: { slow: -6, normal: 0, lively: 5 },
  mood: {
    calm: { rate: -5, pitch: -2, volume: -2 }, wonder: { rate: -2, pitch: 1, volume: 0 },
    joy: { rate: 2, pitch: 3, volume: 2 }, mystery: { rate: -4, pitch: -2, volume: -1 },
    suspense: { rate: -5, pitch: -4, volume: 0 }, gentle_fear: { rate: -6, pitch: -3, volume: -2 },
    sadness: { rate: -6, pitch: -2, volume: -3 }, triumph: { rate: 1, pitch: 3, volume: 3 }
  }
};

function azureVoice(context = {}) {
  return context.heroVoice === 'male' ? 'fr-FR-RemyMultilingualNeural' : 'fr-FR-VivienneMultilingualNeural';
}

function escapeXml(text) {
  return String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function signed(value, suffix) {
  const rounded = Math.round(value || 0);
  return `${rounded >= 0 ? '+' : ''}${rounded}${suffix}`;
}

function azureProsody(context = {}) {
  const ageRate = context.ageBand === '2-5' ? -18 : -10;
  const mood = AZURE_PROFILES.mood[context.narration?.mood] || AZURE_PROFILES.mood.wonder;
  const intensity = Number(context.narration?.intensity || 2);
  const question = String(context.nodeId || '').endsWith('-question');
  return {
    rate: signed(ageRate + (AZURE_PROFILES.pace[context.narration?.pace] || 0) + mood.rate + (intensity === 3 ? 2 : intensity === 1 ? -2 : 0) + (question ? -5 : 0), '%'),
    pitch: signed(mood.pitch + (intensity === 3 ? 1 : 0) + (question ? 1 : 0), 'Hz'),
    volume: signed(mood.volume + (intensity === 3 ? 2 : intensity === 1 ? -2 : 0) + (question ? 2 : 0), '%')
  };
}

async function fetchAzure(text, context) {
  const settings = getSettings();
  const key = getSecrets().azureSpeechKey;
  const region = String(settings.azureSpeechRegion || '').trim().toLowerCase();
  if (!key) throw new Error('Ajoute la clé Azure Speech dans l’espace Parents.');
  if (!/^[a-z0-9-]+$/.test(region)) throw new Error('La région Azure Speech est invalide.');
  const prosody = azureProsody(context);
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fr-FR"><voice name="${azureVoice(context)}"><prosody rate="${prosody.rate}" pitch="${prosody.pitch}" volume="${prosody.volume}">${escapeXml(text)}</prosody></voice></speak>`;
  const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3'
    },
    body: ssml
  });
  if (!response.ok) throw new Error(`La narration Microsoft a échoué (${response.status}).`);
  return response.blob();
}

function timeoutAfter(milliseconds, message) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), milliseconds));
}

async function fetchEdge(text, context) {
  if (Date.now() < edgeRetryAfter) throw new Error('Edge TTS est temporairement écarté après un échec.');
  try {
    edgeModulePromise ||= import(EDGE_TTS_MODULE);
    const edge = await Promise.race([edgeModulePromise, timeoutAfter(5000, 'Le module Edge TTS ne répond pas.')]);
    const TTS = edge.EdgeTTS || edge.UniversalEdgeTTS;
    if (!TTS) throw new Error('Le module Edge TTS est incompatible.');
    const result = await Promise.race([
      new TTS(String(text), azureVoice(context), azureProsody(context)).synthesize(),
      timeoutAfter(Math.min(30000, Math.max(9000, String(text).length * 28)), 'La voix Edge met trop de temps à répondre.')
    ]);
    if (!result?.audio) throw new Error('Edge TTS n’a renvoyé aucun son.');
    if (result.audio instanceof Blob) return result.audio;
    if (typeof result.audio.arrayBuffer === 'function') return new Blob([await result.audio.arrayBuffer()], { type: 'audio/mpeg' });
    return new Blob([result.audio], { type: 'audio/mpeg' });
  } catch (error) {
    edgeModulePromise = null;
    edgeRetryAfter = Date.now() + 5 * 60 * 1000;
    throw error;
  }
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
    const { onProgress, ...debugMeta } = meta;
    const url = URL.createObjectURL(blob);
    const audio = audioPlayer || new Audio();
    audioPlayer = audio;
    currentAudioUrl = url;
    activeResolve = resolve;
    const generation = audioGeneration;
    let settled = false;
    const finish = () => {
      if (settled || generation !== audioGeneration) return;
      settled = true;
      audio.onended = null;
      audio.onerror = null;
      audio.ontimeupdate = null;
      audio.onloadedmetadata = null;
      if (currentAudioUrl === url) {
        URL.revokeObjectURL(url);
        currentAudioUrl = null;
      }
      if (activeResolve === resolve) activeResolve = null;
      resolve();
    };
    audio.preload = 'auto';
    audio.src = url;
    audio.onloadedmetadata = () => onProgress?.(0);
    audio.ontimeupdate = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) onProgress?.(audio.currentTime / audio.duration);
    };
    audio.onended = () => { onProgress?.(1); finish(); };
    audio.onerror = finish;
    logDebug('tts.play', debugMeta);
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
    const ageRate = context.ageBand === '2-5' ? 0.84 : 0.92;
    utterance.rate = context.narration?.pace === 'slow' ? ageRate - 0.06 : context.narration?.pace === 'lively' ? ageRate + 0.08 : ageRate;
    utterance.pitch = ['joy', 'wonder', 'triumph'].includes(mood) ? 1.08 : ['suspense', 'gentle_fear'].includes(mood) ? 0.94 : 1;
    const voice = preferredFrenchVoice(context.heroVoice);
    if (voice) utterance.voice = voice;
    currentUtterance = utterance;
    activeResolve = resolve;
    const finish = () => { context.onProgress?.(1); currentUtterance = null; activeResolve = null; resolve(); };
    utterance.onboundary = event => context.onProgress?.(Math.min(1, event.charIndex / Math.max(1, String(text).length)));
    utterance.onend = finish;
    utterance.onerror = finish;
    speechSynthesis.speak(utterance);
  });
}

export function stopSpeak() {
  audioGeneration += 1;
  try { window.speechSynthesis?.cancel(); } catch {}
  if (audioPlayer) {
    audioPlayer.onended = null;
    audioPlayer.onerror = null;
    audioPlayer.ontimeupdate = null;
    audioPlayer.onloadedmetadata = null;
    audioPlayer.pause();
  }
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
  currentUtterance = null;
  const resolve = activeResolve;
  activeResolve = null;
  resolve?.();
}

export function primeTts() {
  try { window.speechSynthesis?.getVoices(); } catch {}
}

export async function prepareSpeech(text, context = {}) {
  if (!text) return null;
  const settings = getSettings();
  const textHash = hashText(text);
  const providerText = forceFrenchPronunciation(text);
  const staticAudio = await getStaticAudio({ storyId: context.storyId, nodeId: context.nodeId, textHash });
  if (staticAudio) return { blob: staticAudio, source: 'editorial', textHash };

  const portableId = portableAudioId({ ...context, textHash });
  const portable = context.storyId && context.nodeId ? await getAudioCacheEntry(portableId) : null;
  if (portable?.dataUrl) return { blob: dataUrlToBlob(portable.dataUrl), source: 'portable', textHash, voice: portable.voice };

  if (settings.ttsProvider === 'edge-azure') {
    const id = `edge::${azureVoice(context)}::${context.narration?.mood || 'wonder'}::${textHash}`;
    try {
      const cached = await getAudioCacheEntry(id);
      if (cached?.dataUrl) return { blob: dataUrlToBlob(cached.dataUrl), source: 'edge-cache', id, textHash, voice: cached.voice };
      const blob = await fetchEdge(providerText, context);
      const dataUrl = await blobToDataUrl(blob);
      const metadata = { dataUrl, createdAt: Date.now(), textHash, storyId: context.storyId, nodeId: context.nodeId, voice: azureVoice(context), provider: 'edge', narration: context.narration };
      await putAudioCacheEntry({ id, ...metadata });
      if (context.storyId && context.nodeId) await putAudioCacheEntry({ id: portableId, ...metadata });
      return { blob, source: 'edge', id, textHash, voice: metadata.voice };
    } catch (error) {
      logDebug('tts.edge.fallback', { message: error.message });
    }
  }

  if (['edge-azure', 'azure'].includes(settings.ttsProvider) && getSecrets().azureSpeechKey) {
    const id = cacheId(settings, text, context);
    try {
      const cached = await getAudioCacheEntry(id);
      if (cached?.dataUrl) return { blob: dataUrlToBlob(cached.dataUrl), source: 'azure-cache', id, textHash, voice: cached.voice };
      const blob = await fetchAzure(providerText, context);
      const dataUrl = await blobToDataUrl(blob);
      const metadata = { dataUrl, createdAt: Date.now(), textHash, storyId: context.storyId, nodeId: context.nodeId, voice: azureVoice(context), provider: 'azure', narration: context.narration };
      await putAudioCacheEntry({ id, ...metadata });
      if (context.storyId && context.nodeId) await putAudioCacheEntry({ id: portableId, ...metadata });
      return { blob, source: 'azure', id, textHash, voice: metadata.voice };
    } catch (error) {
      logDebug('tts.azure.fallback', { message: error.message });
    }
  }

  if (settings.ttsProvider === 'openai' && getSecrets().openaiApiKey) {
    const id = cacheId(settings, text, context);
    try {
      const cached = await getAudioCacheEntry(id);
      if (cached?.dataUrl) return { blob: dataUrlToBlob(cached.dataUrl), source: 'openai-cache', id, textHash, voice: cached.voice };
      const blobs = [];
      for (const chunk of splitText(providerText)) blobs.push(await fetchOpenAi(chunk, context));
      const blob = new Blob(blobs, { type: 'audio/mpeg' });
      const dataUrl = await blobToDataUrl(blob);
      const metadata = { dataUrl, createdAt: Date.now(), textHash, storyId: context.storyId, nodeId: context.nodeId, voice: settings.openaiVoice, provider: 'openai', narration: context.narration };
      await putAudioCacheEntry({ id, ...metadata });
      if (context.storyId && context.nodeId) await putAudioCacheEntry({ id: portableId, ...metadata });
      return { blob, source: 'openai', id, textHash, voice: metadata.voice };
    } catch (error) {
      logDebug('tts.openai.fallback', { message: error.message });
    }
  }
  return null;
}

export async function speak(text, context = {}) {
  if (!text) return;
  const prepared = await prepareSpeech(text, context);
  if (prepared?.blob) return playBlob(prepared.blob, { source: prepared.source, id: prepared.id, ...context });
  return speakBrowser(text, context);
}

export async function warmTtsCache(items = []) {
  let stored = 0;
  let skipped = 0;
  for (const item of items) {
    const text = typeof item === 'string' ? item : item.text;
    const context = typeof item === 'string' ? {} : item;
    if (await prepareSpeech(text, context)) stored += 1;
    else skipped += 1;
  }
  return { stored, skipped };
}
