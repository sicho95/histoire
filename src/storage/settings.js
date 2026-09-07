const SETTINGS_KEY = 'histoires_settings_v2';
const SESSION_SECRET_KEY = 'histoires_secrets_session_v2';
const DEVICE_SECRET_KEY = 'histoires_secrets_device_v2';
const LEGACY_KEY = 'conteur_settings_v11';

const defaults = {
  pin: '',
  generationProvider: 'groq',
  generationModel: 'openai/gpt-oss-120b',
  ttsProvider: 'browser',
  openaiTtsModel: 'gpt-4o-mini-tts',
  openaiVoice: 'marin',
  narrationStyle: 'warm-storyteller-v2',
  speechRate: 0.94,
  rememberKeys: false,
  autoSyncCatalog: true,
  debugEnabled: false
};

function storageAvailable() { return typeof localStorage !== 'undefined' && typeof sessionStorage !== 'undefined'; }
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
  const secrets = { groqApiKey: legacy.apiKey || '', openaiApiKey: legacy.openaiApiKey || '' };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  sessionStorage.setItem(SESSION_SECRET_KEY, JSON.stringify(secrets));
  localStorage.removeItem(LEGACY_KEY);
}

migrateLegacy();

export function getSettings() {
  if (!storageAvailable()) return { ...defaults };
  return { ...defaults, ...parse(localStorage, SETTINGS_KEY) };
}

export function saveSettings(next) {
  if (!storageAvailable()) return;
  const safe = { ...defaults, ...next };
  delete safe.groqApiKey;
  delete safe.openaiApiKey;
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
    openaiApiKey: String(secrets.openaiApiKey || '').trim()
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
