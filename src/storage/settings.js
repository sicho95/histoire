const KEY = 'conteur_settings_v4';
export function getSettings() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { provider: 'groq', model: 'llama-3.3-70b-versatile', apiKey: '', pin: '' }; }
  catch { return { provider: 'groq', model: 'llama-3.3-70b-versatile', apiKey: '', pin: '' }; }
}
export function saveSettings(settings) { localStorage.setItem(KEY, JSON.stringify(settings)); }
