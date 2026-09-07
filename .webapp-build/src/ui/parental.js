import { exportAllData, importAllData } from '../storage/database.js';
import { getSecrets, getSettings, saveSecrets, saveSettings } from '../storage/settings.js';
import { showToast } from './toast.js';

export function downloadJson(payload, filename) {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function renderParental() {
  const settings = getSettings();
  const secrets = getSecrets();
  document.getElementById('groq-key').value = secrets.groqApiKey || '';
  document.getElementById('openai-key').value = secrets.openaiApiKey || '';
  document.getElementById('generation-model').value = settings.generationModel;
  document.getElementById('tts-provider').value = settings.ttsProvider;
  document.getElementById('openai-voice').value = settings.openaiVoice;
  document.getElementById('remember-keys').checked = settings.rememberKeys;
}

export function initParental() {
  document.getElementById('save-settings').onclick = () => {
    const settings = {
      ...getSettings(),
      generationModel: document.getElementById('generation-model').value,
      ttsProvider: document.getElementById('tts-provider').value,
      openaiVoice: document.getElementById('openai-voice').value,
      rememberKeys: document.getElementById('remember-keys').checked
    };
    saveSettings(settings);
    saveSecrets({ groqApiKey: document.getElementById('groq-key').value, openaiApiKey: document.getElementById('openai-key').value }, { remember: settings.rememberKeys });
    document.getElementById('settings-status').textContent = settings.rememberKeys ? 'Enregistré sur cet appareil.' : 'Enregistré pour cette session.';
    showToast('Réglages enregistrés.');
  };
  document.getElementById('export-data').onclick = async () => downloadJson(await exportAllData(), `histoires-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`);
  document.getElementById('import-data').onchange = async event => {
    try { await importAllData(JSON.parse(await event.target.files[0].text())); showToast('Sauvegarde importée.'); }
    catch (error) { showToast(error.message); }
    event.target.value = '';
  };
}
