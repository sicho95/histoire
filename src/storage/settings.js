const KEY = 'conteur_settings_v5';
const defaults = {
  provider: 'groq',
  model: 'llama-3.3-70b-versatile',
  apiKey: '',
  pin: '',
  ttsProvider: 'browser',
  ttsApiKey: '',
  ttsVoice: 'nova',
  debugEnabled: false
};
export function getSettings() {
  try { return { ...defaults, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
  catch { return { ...defaults }; }
}
export function saveSettings(settings) { localStorage.setItem(KEY, JSON.stringify({ ...defaults, ...settings })); }
