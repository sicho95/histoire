const SETTINGS_KEY = 'histoires_settings_v2';
const SESSION_SECRET_KEY = 'histoires_secrets_session_v2';
const DEVICE_SECRET_KEY = 'histoires_secrets_device_v2';
const LEGACY_KEY = 'conteur_settings_v11';

const defaults = {
  pin: '',
  theme: 'auto',
  generationProvider: 'groq',
  generationModel: 'openai/gpt-oss-120b',
  ttsProvider: 'auto',
  ttsCascadeVersion: 2,
  azureSpeechRegion: 'francecentral',
  openaiTtsModel: 'gpt-4o-mini-tts',
  openaiVoice: 'marin',
  googleTtsModel: 'gemini-3.1-flash-tts-preview',
  narrationStyle: 'warm-storyteller-v2',
  speechRate: 0.94,
  quietMode: false,
  rememberKeys: false,
  autoSyncCatalog: true,
  debugEnabled: false
};

function storageAvailable() {
  return typeof localStorage !== 'undefined'
    && typeof sessionStorage !== 'undefined'
    && typeof localStorage.getItem === 'function'
    && typeof sessionStorage.getItem === 'function';
}
function parse(storage, key) {
  try { return JSON.parse(storage.getItem(key) || '{}'); } catch { return {}; }
}

function migrateLegacy() {
  if (!storageAvailable() || localStorage.getItem(SETTINGS_KEY) || !localStorage.getItem(LEGACY_KEY)) return;
  const legacy = parse(localStorage, LEGACY_KEY);
  const settings = {
    ...defaults,
    pin: legacy.pin || '',
    generationModel: legacy.model || defaults.generationModel,
    ttsProvider: legacy.ttsProvider === 'openai' ? 'openai' : 'browser',
    openaiVoice: legacy.openaiVoice || defaults.openaiVoice,
    speechRate: Number(legacy.gcpSpeakingRate || defaults.speechRate),
    debugEnabled: Boolean(legacy.debugEnabled)
  };
  const secrets = { groqApiKey: legacy.apiKey || '', openaiApiKey: legacy.openaiApiKey || '', azureSpeechKey: '', googleAiKey: '' };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  sessionStorage.setItem(SESSION_SECRET_KEY, JSON.stringify(secrets));
  localStorage.removeItem(LEGACY_KEY);
}

migrateLegacy();

export function getSettings() {
  if (!storageAvailable()) return { ...defaults };
  const stored = parse(localStorage, SETTINGS_KEY);
  if (Number(stored.ttsCascadeVersion || 0) < 2) {
    stored.ttsProvider = ['openai', 'azure', 'browser'].includes(stored.ttsProvider) ? stored.ttsProvider : 'auto';
    stored.ttsCascadeVersion = 2;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaults, ...stored }));
  }
  if (stored.ttsProvider === 'edge-azure') stored.ttsProvider = 'auto';
  return { ...defaults, ...stored };
}

export function saveSettings(next) {
  if (!storageAvailable()) return;
  const safe = { ...defaults, ...next };
  delete safe.groqApiKey;
  delete safe.openaiApiKey;
  delete safe.azureSpeechKey;
  delete safe.googleAiKey;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(safe));
}

export function getSecrets() {
  if (!storageAvailable()) return {};
  const settings = getSettings();
  return settings.rememberKeys ? parse(localStorage, DEVICE_SECRET_KEY) : parse(sessionStorage, SESSION_SECRET_KEY);
}

export function saveSecrets(secrets, { remember = getSettings().rememberKeys } = {}) {
  if (!storageAvailable()) return;
  const clean = {
    groqApiKey: String(secrets.groqApiKey || '').trim(),
    openaiApiKey: String(secrets.openaiApiKey || '').trim(),
    azureSpeechKey: String(secrets.azureSpeechKey || '').trim(),
    googleAiKey: String(secrets.googleAiKey || '').trim()
  };
  sessionStorage.setItem(SESSION_SECRET_KEY, JSON.stringify(clean));
  if (remember) localStorage.setItem(DEVICE_SECRET_KEY, JSON.stringify(clean));
  else localStorage.removeItem(DEVICE_SECRET_KEY);
}

export function clearSecrets() {
  if (!storageAvailable()) return;
  sessionStorage.removeItem(SESSION_SECRET_KEY);
  localStorage.removeItem(DEVICE_SECRET_KEY);
}

export function hasGenerationKey() { return Boolean(getSecrets().groqApiKey); }
