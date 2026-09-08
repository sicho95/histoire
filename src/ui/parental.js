import { exportAllData, importAllData } from '../storage/database.js';
import { getSecrets, getSettings, saveSecrets, saveSettings } from '../storage/settings.js';
import { showToast } from './toast.js';
import { importStoryPackage } from '../export/story-package.js';
import { setView } from '../core/state.js';

function requestParentalAccess(settings) {
  const dialog = document.getElementById('parent-gate');
  const form = document.getElementById('parent-gate-form');
  const input = document.getElementById('parent-gate-pin');
  const confirmation = document.getElementById('parent-gate-confirm');
  const confirmationRow = document.getElementById('parent-gate-confirm-row');
  const error = document.getElementById('parent-gate-error');
  const setup = !settings.pin;
  document.getElementById('parent-gate-help').textContent = setup
    ? 'Choisissez un code que les enfants ne connaissent pas.'
    : 'Saisissez le code choisi par un parent.';
  confirmationRow.classList.toggle('hidden', !setup);
  confirmation.required = setup;
  input.value = '';
  confirmation.value = '';
  error.textContent = '';
  dialog.showModal();
  input.focus();
  return new Promise(resolve => {
    const finish = value => { dialog.close(); form.onsubmit = null; resolve(value); };
    document.getElementById('parent-gate-cancel').onclick = () => finish(null);
    dialog.oncancel = event => { event.preventDefault(); finish(null); };
    form.onsubmit = event => {
      event.preventDefault();
      const pin = input.value.trim();
      if (!/^\d{4}$/.test(pin)) { error.textContent = 'Le code doit contenir exactement 4 chiffres.'; return; }
      if (setup && pin !== confirmation.value.trim()) { error.textContent = 'Les deux codes ne correspondent pas.'; return; }
      if (!setup && pin !== settings.pin) { error.textContent = 'Code incorrect.'; input.value = ''; input.focus(); return; }
      finish(pin);
    };
  });
}

export async function openParental() {
  const settings = getSettings();
  const pin = await requestParentalAccess(settings);
  if (!pin) return;
  if (!settings.pin) saveSettings({ ...settings, pin });
  setView('view-parents');
  renderParental();
}

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
  document.getElementById('azure-speech-key').value = secrets.azureSpeechKey || '';
  document.getElementById('azure-speech-region').value = settings.azureSpeechRegion || 'francecentral';
  document.getElementById('generation-model').value = settings.generationModel;
  document.getElementById('tts-provider').value = settings.ttsProvider;
  document.getElementById('openai-voice').value = settings.openaiVoice;
  document.getElementById('remember-keys').checked = settings.rememberKeys;
  document.getElementById('parent-pin').value = settings.pin || '';
}

export function initParental() {
  document.getElementById('save-settings').onclick = () => {
    const pin = document.getElementById('parent-pin').value.trim();
    if (!/^\d{4}$/.test(pin)) return showToast('Choisissez un code Parents de 4 chiffres.');
    const settings = {
      ...getSettings(),
      pin,
      generationModel: document.getElementById('generation-model').value,
      ttsProvider: document.getElementById('tts-provider').value,
      azureSpeechRegion: document.getElementById('azure-speech-region').value.trim(),
      openaiVoice: document.getElementById('openai-voice').value,
      rememberKeys: document.getElementById('remember-keys').checked
    };
    saveSettings(settings);
    saveSecrets({
      groqApiKey: document.getElementById('groq-key').value,
      openaiApiKey: document.getElementById('openai-key').value,
      azureSpeechKey: document.getElementById('azure-speech-key').value
    }, { remember: settings.rememberKeys });
    window.dispatchEvent(new CustomEvent('app:secretsChanged'));
    document.getElementById('settings-status').textContent = settings.rememberKeys ? 'Enregistré sur cet appareil.' : 'Enregistré pour cette session.';
    showToast('Réglages enregistrés.');
  };
  document.getElementById('export-data').onclick = async () => downloadJson(await exportAllData(), `histoires-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`);
  document.getElementById('import-data').onchange = async event => {
    try {
      const file = event.target.files[0];
      if (!file) return;
      if (/\.zip$/i.test(file.name) || file.type === 'application/zip') {
        const result = await importStoryPackage(file);
        showToast(`Histoire et ${result.audioCount} voix importées.`);
      } else {
        await importAllData(JSON.parse(await file.text()));
        showToast('Sauvegarde importée.');
      }
    }
    catch (error) { showToast(error.message); }
    event.target.value = '';
  };
}
