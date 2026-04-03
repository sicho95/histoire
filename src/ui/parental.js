import { exportAllData, importAllData } from '../storage/database.js';
import { getSettings, saveSettings } from '../storage/settings.js';
import { setView } from '../core/state.js';
import { renderHome } from './carousel.js';
function buildPinPad(target, onSuccess) {
  const settings = getSettings();
  let typed = '';
  target.innerHTML = `
    <h2 class="pin-title">Espace parents</h2>
    <p class="pin-help">Saisis le code PIN à 4 chiffres.</p>
    <div class="pin-display" id="pin-display">• • • •</div>
    <p class="pin-error" id="pin-error"></p>
    <div class="pin-pad"></div>
    <div class="row-actions row-actions--center"><button class="btn-secondary" id="pin-cancel">Retour</button></div>`;
  const display = target.querySelector('#pin-display');
  const error = target.querySelector('#pin-error');
  const pad = target.querySelector('.pin-pad');
  const redraw = () => { display.textContent = Array.from({ length: 4 }, (_, i) => typed[i] ? '•' : '◦').join(' '); };
  const push = d => {
    if (typed.length >= 4) return;
    typed += d;
    redraw();
    if (typed.length === 4) {
      if (typed === (settings.pin || '2580')) onSuccess();
      else { error.textContent = 'Code incorrect'; typed = ''; setTimeout(redraw, 80); }
    }
  };
  ['1','2','3','4','5','6','7','8','9','←','0','✓'].forEach(key => {
    const btn = document.createElement('button');
    btn.className = 'pin-key';
    btn.textContent = key;
    btn.onclick = () => {
      if (key === '←') { typed = typed.slice(0, -1); redraw(); return; }
      if (key === '✓') { if (typed === (settings.pin || '2580')) onSuccess(); return; }
      push(key);
    };
    pad.appendChild(btn);
  });
  target.querySelector('#pin-cancel').onclick = () => { renderHome(); setView('view-home'); };
  redraw();
}
export function renderParental() {
  setView('view-parental');
  const settings = getSettings();
  const gate = document.getElementById('pin-gate');
  const content = document.getElementById('parental-content');
  content.classList.add('hidden');
  buildPinPad(gate, () => {
    gate.innerHTML = '';
    content.classList.remove('hidden');
    document.getElementById('input-provider').value = settings.provider || 'groq';
    document.getElementById('input-api-key').value = settings.apiKey || '';
    document.getElementById('input-model').value = settings.model || 'llama-3.3-70b-versatile';
  });
  document.getElementById('btn-parental-back').onclick = () => { renderHome(); setView('view-home'); };
  document.getElementById('btn-save-settings').onclick = () => {
    saveSettings({ ...settings, provider: document.getElementById('input-provider').value, apiKey: document.getElementById('input-api-key').value.trim(), model: document.getElementById('input-model').value.trim() || 'llama-3.3-70b-versatile' });
    alert('Paramètres enregistrés');
  };
  document.getElementById('btn-export').onclick = async () => {
    const blob = new Blob([JSON.stringify(await exportAllData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'conteur-backup.json'; a.click();
  };
  document.getElementById('import-file').onchange = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await importAllData(JSON.parse(text));
    alert('Import terminé');
  };
}
