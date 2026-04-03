const KEY = 'conteur_settings_v2';
export function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { provider: 'groq', model: 'llama-3.3-70b-versatile', apiKey: '', pin: '2580' };
  } catch {
    return { provider: 'groq', model: 'llama-3.3-70b-versatile', apiKey: '', pin: '2580' };
  }
}
export function saveSettings(settings) { localStorage.setItem(KEY, JSON.stringify(settings)); }
