import { exportAllData, importAllData } from '../storage/database.js';
import { getSettings, saveSettings } from '../storage/settings.js';
import { setView } from '../core/state.js';
import { renderHome } from './carousel.js';
import { clearDebugEntries, downloadDebugTxt, logDebug } from '../core/debug.js';
function buildPinPad(target, onSuccess) {
  const settings = getSettings();
  let typed = '';
  let firstEntry = '';
  const setupMode = !settings.pin;
  target.innerHTML = `<h2 class="pin-title">Espace parents</h2><p class="pin-help">${setupMode ? 'Choisis un code PIN à 4 chiffres.' : 'Saisis le code PIN à 4 chiffres.'}</p><div class="pin-display" id="pin-display">_ _ _ _</div><p class="pin-error" id="pin-error"></p><div class="pin-pad"></div><div class="row-actions row-actions--center"><button class="btn-secondary" id="pin-cancel">Retour</button></div>`;
  const display = target.querySelector('#pin-display');
  const error = target.querySelector('#pin-error');
  const pad = target.querySelector('.pin-pad');
  const redraw = () => { display.textContent = Array.from({ length: 4 }, (_, i) => typed[i] || '_').join(' '); };
  const validate = () => {
    if (typed.length < 4) return;
    if (setupMode) {
      if (!firstEntry) { firstEntry = typed; typed = ''; error.textContent = 'Confirme le même code PIN.'; redraw(); return; }
      if (typed !== firstEntry) { error.textContent = 'Les deux codes sont différents.'; typed = ''; firstEntry = ''; redraw(); return; }
      saveSettings({ ...settings, pin: typed });
      onSuccess();
      return;
    }
    if (typed === settings.pin) { onSuccess(); return; }
    error.textContent = 'Code incorrect'; typed = ''; redraw();
  };
  ['1','2','3','4','5','6','7','8','9','←','0','✓'].forEach(key => {
    const btn = document.createElement('button');
    btn.className = 'pin-key'; btn.textContent = key;
    btn.onclick = () => {
      if (key === '←') { typed = typed.slice(0, -1); redraw(); return; }
      if (key === '✓') { validate(); return; }
      if (typed.length < 4) typed += key;
      redraw();
      if (typed.length === 4) validate();
    };
    pad.appendChild(btn);
  });
  target.querySelector('#pin-cancel').onclick = () => renderHome();
  redraw();
}
export function renderParental() {
  setView('view-parental');
  const gate = document.getElementById('pin-gate');
  const content = document.getElementById('parental-content');
  content.classList.add('hidden');
  buildPinPad(gate, () => {
    gate.innerHTML = '';
    content.classList.remove('hidden');
    const fresh = getSettings();
    document.getElementById('input-provider').value = fresh.provider || 'groq';
    document.getElementById('input-api-key').value = fresh.apiKey || '';
    document.getElementById('input-model').value = fresh.model || 'llama-3.3-70b-versatile';
    document.getElementById('input-tts-provider').value = fresh.ttsProvider || 'browser';
    document.getElementById('input-tts-api-key').value = fresh.ttsApiKey || '';
    document.getElementById('input-tts-voice').value = fresh.ttsVoice || 'nova';
    document.getElementById('input-debug-enabled').checked = !!fresh.debugEnabled;
  });
  document.getElementById('btn-parental-back').onclick = () => renderHome();
  document.getElementById('btn-save-settings').onclick = () => {
    const next = {
      ...getSettings(),
      provider: document.getElementById('input-provider').value,
      apiKey: document.getElementById('input-api-key').value.trim(),
      model: document.getElementById('input-model').value.trim() || 'llama-3.3-70b-versatile',
      ttsProvider: document.getElementById('input-tts-provider').value,
      ttsApiKey: document.getElementById('input-tts-api-key').value.trim(),
      ttsVoice: document.getElementById('input-tts-voice').value.trim() || 'nova',
      debugEnabled: document.getElementById('input-debug-enabled').checked
    };
    saveSettings(next);
    logDebug('settings.saved', { provider: next.provider, model: next.model, ttsProvider: next.ttsProvider, ttsVoice: next.ttsVoice, debugEnabled: next.debugEnabled });
    alert('Paramètres enregistrés');
  };
  document.getElementById('btn-export').onclick = async () => {
    const blob = new Blob([JSON.stringify(await exportAllData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'conteur-backup.json';
    a.click();
  };
  document.getElementById('import-file').onchange = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importAllData(JSON.parse(await file.text()));
    alert('Import terminé');
  };
  document.getElementById('btn-download-debug').onclick = () => downloadDebugTxt();
  document.getElementById('btn-clear-debug').onclick = () => { clearDebugEntries(); alert('Debug vidé'); };
}
