const KEY = 'conteur_settings_v8';
const defaults = {
  provider: 'groq',
  model: 'llama-3.3-70b-versatile',
  apiKey: '',
  pin: '',
  ttsProvider: 'browser',
  ttsApiKey: '',
  ttsVoice: '',
  ttsModel: 'eleven_multilingual_v2',
  ttsFormat: 'mp3_44100_128',
  ttsForceFrench: true,
  debugEnabled: false
};

export function getSettings() {
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(KEY)) || {}) };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(KEY, JSON.stringify({ ...defaults, ...settings }));
}
