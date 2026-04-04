
const KEY = 'conteur_settings_v11';
const defaults = {
  // LLM
  provider: 'groq',
  model: 'llama-3.3-70b-versatile',
  apiKey: '',
  // TTS provider: browser | gcp | openai | elevenlabs
  ttsProvider: 'browser',
  // GCP
  gcpApiKey: '',
  gcpVoiceName: 'fr-FR-Wavenet-A',
  gcpVoiceType: 'Wavenet',
  gcpLanguage: 'fr-FR',
  gcpCharsThisMonth: 0,
  gcpMonthKey: '',
  // OpenAI TTS
  openaiApiKey: '',
  openaiVoice: 'nova',
  // ElevenLabs
  elevenApiKey: '',
  elevenVoiceId: '21m00Tcm4TlvDq8ikWAM',
  elevenModel: 'eleven_multilingual_v2',
  elevenFormat: 'mp3_44100_128',
  elevenForceFrench: true,
  elevenQuota: null,
  // General
  pin: '',
  offlineCacheMode: 'selected',
  offlineSelectedStoryId: '',
  debugEnabled: false,
};
export function getSettings() {
  try { return { ...defaults, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
  catch { return { ...defaults }; }
}
export function saveSettings(s) {
  localStorage.setItem(KEY, JSON.stringify({ ...defaults, ...s }));
}
