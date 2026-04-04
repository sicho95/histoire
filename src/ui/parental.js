import { exportAllData, importAllData, getAllStories, getLibrary } from '../storage/database.js';
import { getSettings, saveSettings } from '../storage/settings.js';
import { setView } from '../core/state.js';
import { renderHome } from './carousel.js';
import { clearDebugEntries, downloadDebugTxt, logDebug } from '../core/debug.js';
import { clearAudioCache, listAudioCacheEntries } from '../storage/audio_cache.js';
import { warmTtsCache, fetchElevenSubscription } from '../audio/tts.js';

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
      saveSettings({ ...settings, pin: typed }); onSuccess(); return;
    }
    if (typed === settings.pin) { onSuccess(); return; }
    error.textContent = 'Code incorrect'; typed = ''; redraw();
  };
  ['1','2','3','4','5','6','7','8','9','←','0','✓'].forEach(key => {
    const btn = document.createElement('button'); btn.className = 'pin-key'; btn.textContent = key;
    btn.onclick = () => { if (key === '←') { typed = typed.slice(0, -1); redraw(); return; } if (key === '✓') { validate(); return; } if (typed.length < 4) typed += key; redraw(); if (typed.length === 4) validate(); };
    pad.appendChild(btn);
  });
  target.querySelector('#pin-cancel').onclick = () => renderHome();
  redraw();
}

function storyTexts(story) {
  const texts = [story.title, story.intro || ''];
  for (const node of Object.values(story.nodes || {})) texts.push(node.text || '', node.question || '');
  return texts.filter(Boolean);
}

async function refreshCacheStatus() {
  const entries = await listAudioCacheEntries();
  const el = document.getElementById('offline-cache-status');
  if (el) el.textContent = `${entries.length} audio(s) en cache. Les éléments déjà présents ne sont pas regénérés.`;
}

async function refreshStorySelect() {
  const select = document.getElementById('input-offline-story');
  if (!select) return;
  const stories = await getAllStories();
  const library = await getLibrary();
  const current = getSettings().offlineSelectedStoryId || stories[0]?.id || '';
  const html = [];
  html.push('<optgroup label="Histoires de base">');
  stories.forEach(story => html.push(`<option value="story:${story.id}">${story.title}</option>`));
  html.push('</optgroup>');
  if (library.length) {
    html.push('<optgroup label="Bibliothèque">');
    library.forEach((item, i) => html.push(`<option value="library:${item.id ?? i}">${item.title || item.storyTitle || `Aventure ${i + 1}`}</option>`));
    html.push('</optgroup>');
  }
  select.innerHTML = html.join('');
  if (select.querySelector(`option[value="${current}"]`)) select.value = current;
}

function collectAllTexts(stories, library) {
  const texts = [];
  stories.forEach(story => texts.push(...storyTexts(story)));
  library.forEach(item => {
    if (item?.story) texts.push(...storyTexts(item.story));
    else if (item?.nodes) texts.push(...storyTexts(item));
  });
  return texts.filter(Boolean);
}

async function preCacheScope(scope) {
  const stories = await getAllStories();
  const library = await getLibrary();
  const select = document.getElementById('input-offline-story');
  let texts = [];
  if (scope === 'base') texts = collectAllTexts(stories.filter(s => !s.is_user_created), []);
  if (scope === 'library') texts = collectAllTexts([], library);
  if (scope === 'all') texts = collectAllTexts(stories, library);
  if (scope === 'selected') {
    const value = select?.value || '';
    if (value.startsWith('story:')) {
      const story = stories.find(s => s.id === value.slice(6));
      if (story) texts = storyTexts(story);
    }
    if (value.startsWith('library:')) {
      const item = library.find(s => String(s.id) === value.slice(8));
      if (item?.story) texts = storyTexts(item.story);
      else if (item?.nodes) texts = storyTexts(item);
    }
  }
  const result = await warmTtsCache(texts);
  logDebug('offline.precache.scope', { scope, texts: texts.length, result });
  await refreshCacheStatus();
  alert(`Préchargement terminé : ${result.stored} nouveau(x), ${result.skipped} déjà présent(s).`);
}

function syncVoiceOptions(provider) {
  const voiceSelect = document.getElementById('input-tts-voice');
  if (!voiceSelect) return;
  [...voiceSelect.options].forEach(option => {
    const p = option.dataset.provider;
    if (!p) return;
    option.hidden = p !== provider;
  });
  const current = voiceSelect.value;
  const currentOption = voiceSelect.querySelector(`option[value="${current}"]`);
  if (!current || currentOption?.hidden) {
    const first = voiceSelect.querySelector(`option[data-provider="${provider}"]`);
    if (first) voiceSelect.value = first.value;
  }
}

function bindTabs() {
  const buttons = [...document.querySelectorAll('.tab-btn')];
  const panels = [...document.querySelectorAll('.tab-panel')];
  buttons.forEach(btn => {
    btn.onclick = () => {
      buttons.forEach(b => b.classList.toggle('active', b === btn));
      panels.forEach(panel => panel.classList.toggle('active', panel.id === btn.dataset.tab));
    };
  });
}

async function refreshQuotaBox() {
  const box = document.getElementById('elevenlabs-quota-box');
  const text = document.getElementById('elevenlabs-quota-text');
  const settings = getSettings();
  if (!box || !text) return;
  if (settings.ttsProvider !== 'elevenlabs' || !settings.ttsApiKey) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  text.textContent = 'Lecture du quota…';
  const info = await fetchElevenSubscription(settings.ttsApiKey);
  if (!info?.ok) { text.textContent = `Impossible de lire le quota (${info?.error || 'erreur'}).`; return; }
  const remaining = Math.max(0, (info.character_limit || 0) - (info.character_count || 0));
  text.textContent = `${remaining.toLocaleString('fr-FR')} caractères restants / ${Number(info.character_limit || 0).toLocaleString('fr-FR')} — utilisés : ${Number(info.character_count || 0).toLocaleString('fr-FR')} (${info.tier || 'plan inconnu'})`;
  saveSettings({ ...settings, elevenQuota: info });
}

export function renderParental() {
  setView('view-parental');
  const gate = document.getElementById('pin-gate');
  const content = document.getElementById('parental-content');
  content.classList.add('hidden');
  buildPinPad(gate, async () => {
    gate.innerHTML = '';
    content.classList.remove('hidden');
    bindTabs();
    const fresh = getSettings();
    document.getElementById('input-pin-edit').value = fresh.pin || '';
    document.getElementById('input-api-key').value = fresh.apiKey || '';
    document.getElementById('input-model').value = fresh.model || 'llama-3.3-70b-versatile';
    document.getElementById('input-tts-provider').value = fresh.ttsProvider || 'browser';
    document.getElementById('input-tts-api-key').value = fresh.ttsApiKey || '';
    document.getElementById('input-tts-model').value = fresh.ttsModel || 'eleven_multilingual_v2';
    document.getElementById('input-tts-format').value = fresh.ttsFormat || 'mp3_44100_128';
    document.getElementById('input-tts-force-french').checked = fresh.ttsForceFrench !== false;
    document.getElementById('input-offline-mode').value = fresh.offlineCacheMode || 'selected';
    document.getElementById('input-debug-enabled').checked = !!fresh.debugEnabled;
    syncVoiceOptions(fresh.ttsProvider || 'browser');
    document.getElementById('input-tts-voice').value = fresh.ttsVoice || document.getElementById('input-tts-voice').value;
    document.getElementById('input-tts-provider').onchange = async e => { syncVoiceOptions(e.target.value); await refreshQuotaBox(); };
    document.getElementById('btn-refresh-quota').onclick = () => refreshQuotaBox();
    await refreshStorySelect();
    if (fresh.offlineSelectedStoryId) document.getElementById('input-offline-story').value = fresh.offlineSelectedStoryId;
    document.getElementById('input-offline-story').onchange = e => saveSettings({ ...getSettings(), offlineSelectedStoryId: e.target.value });
    await refreshCacheStatus();
    await refreshQuotaBox();
  });
  document.getElementById('btn-parental-back').onclick = () => renderHome();
  document.getElementById('btn-save-settings').onclick = async () => {
    const next = {
      ...getSettings(),
      pin: document.getElementById('input-pin-edit').value.trim() || getSettings().pin || '',
      apiKey: document.getElementById('input-api-key').value.trim(),
      model: document.getElementById('input-model').value.trim() || 'llama-3.3-70b-versatile',
      ttsProvider: document.getElementById('input-tts-provider').value,
      ttsApiKey: document.getElementById('input-tts-api-key').value.trim(),
      ttsVoice: document.getElementById('input-tts-voice').value.trim(),
      ttsModel: document.getElementById('input-tts-model').value || 'eleven_multilingual_v2',
      ttsFormat: document.getElementById('input-tts-format').value || 'mp3_44100_128',
      ttsForceFrench: document.getElementById('input-tts-force-french').checked,
      offlineCacheMode: document.getElementById('input-offline-mode').value,
      offlineSelectedStoryId: document.getElementById('input-offline-story').value,
      debugEnabled: document.getElementById('input-debug-enabled').checked
    };
    saveSettings(next);
    await refreshQuotaBox();
    logDebug('settings.saved', { model: next.model, ttsProvider: next.ttsProvider, ttsVoice: next.ttsVoice, ttsModel: next.ttsModel, ttsFormat: next.ttsFormat, ttsForceFrench: next.ttsForceFrench, offlineCacheMode: next.offlineCacheMode, offlineSelectedStoryId: next.offlineSelectedStoryId });
    alert('Paramètres enregistrés ✓');
  };
  document.getElementById('btn-export').onclick = async () => {
    const blob = new Blob([JSON.stringify(await exportAllData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'conteur-backup.json'; a.click();
  };
  document.getElementById('import-file').onchange = async e => {
    const file = e.target.files?.[0]; if (!file) return; await importAllData(JSON.parse(await file.text())); await refreshStorySelect(); alert('Import terminé');
  };
  document.getElementById('btn-download-debug').onclick = () => downloadDebugTxt();
  document.getElementById('btn-clear-debug').onclick = () => { clearDebugEntries(); alert('Debug vidé'); };
  document.getElementById('btn-precache-selected').onclick = () => preCacheScope('selected');
  document.getElementById('btn-precache-base-audio').onclick = () => preCacheScope('base');
  document.getElementById('btn-precache-library').onclick = () => preCacheScope('library');
  document.getElementById('btn-precache-all').onclick = () => preCacheScope('all');
  document.getElementById('btn-clear-audio-cache').onclick = async () => { await clearAudioCache(); await refreshCacheStatus(); };
}
