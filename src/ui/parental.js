
import { exportAllData, importAllData, getAllStories, getLibrary, importStory, exportStory } from '../storage/database.js';
import { clearAudioCache, listAudioCacheEntries, importCacheEntries } from '../storage/audio_cache.js';
import { getSettings, saveSettings } from '../storage/settings.js';
import { setView } from '../core/state.js';
import { renderHome } from './carousel.js';
import { clearDebugEntries, downloadDebugTxt, logDebug } from '../core/debug.js';
import { warmTtsCache, fetchElevenSubscription } from '../audio/tts.js';

// ── PIN PAD ──────────────────────────────────────────────────────────────────
function buildPinPad(target, onSuccess) {
  const s=getSettings(); let typed='',firstEntry='';
  const setup=!s.pin;
  target.innerHTML=`<h2 class="pin-title">Espace parents</h2><p class="pin-help">${setup?'Choisis un code PIN à 4 chiffres.':'Code PIN à 4 chiffres.'}</p><div class="pin-display" id="pin-display">_ _ _ _</div><p class="pin-error" id="pin-error"></p><div class="pin-pad"></div><div class="row-actions row-actions--center"><button class="btn-secondary" id="pin-cancel">Retour</button></div>`;
  const disp=target.querySelector('#pin-display'),err=target.querySelector('#pin-error'),pad=target.querySelector('.pin-pad');
  const redraw=()=>{disp.textContent=Array.from({length:4},(_,i)=>typed[i]||'_').join(' ');};
  const validate=()=>{
    if(typed.length<4)return;
    if(setup){if(!firstEntry){firstEntry=typed;typed='';err.textContent='Confirme le même PIN.';redraw();return;}
      if(typed!==firstEntry){err.textContent='Codes différents.';typed='';firstEntry='';redraw();return;}
      saveSettings({...s,pin:typed});onSuccess();return;}
    if(typed===s.pin){onSuccess();return;}
    err.textContent='Code incorrect';typed='';redraw();
  };
  ['1','2','3','4','5','6','7','8','9','←','0','✓'].forEach(k=>{
    const b=document.createElement('button');b.className='pin-key';b.textContent=k;
    b.onclick=()=>{if(k==='←'){typed=typed.slice(0,-1);redraw();return;}if(k==='✓'){validate();return;}if(typed.length<4)typed+=k;redraw();if(typed.length===4)validate();};
    pad.appendChild(b);});
  target.querySelector('#pin-cancel').onclick=()=>renderHome();
  redraw();
}

// ── TABS ─────────────────────────────────────────────────────────────────────
function bindTabs() {
  const btns=[...document.querySelectorAll('.tab-btn')];
  const panels=[...document.querySelectorAll('.tab-panel')];
  btns.forEach(b=>{ b.onclick=()=>{ btns.forEach(x=>x.classList.toggle('active',x===b)); panels.forEach(p=>p.classList.toggle('active',p.id===b.dataset.tab)); }; });
}

// ── QUOTA helpers ─────────────────────────────────────────────────────────────
function gcpQuotaLimit(type) {
  if(type==='Standard') return 4_000_000;
  if(type==='Journey')  return 1_000_000;
  return 1_000_000; // Wavenet
}
function refreshGcpQuota(s) {
  const box=document.getElementById('gcp-quota-box');if(!box)return;
  if(!s.gcpApiKey){box.classList.add('hidden');return;}
  box.classList.remove('hidden');
  const now=new Date();const mk=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const used=s.gcpMonthKey===mk?s.gcpCharsThisMonth:0;
  const limit=gcpQuotaLimit(s.gcpVoiceType||'Wavenet');
  const pct=Math.min(100,Math.round(used/limit*100));
  const remain=(limit-used).toLocaleString('fr-FR');
  document.getElementById('gcp-quota-text').textContent=`${remain} caractères gratuits restants ce mois (${pct}% utilisé — quota ${type_label(s.gcpVoiceType)})`;
  const bar=document.getElementById('gcp-quota-bar');if(bar)bar.style.width=pct+'%';
}
function type_label(t){return t==='Standard'?'4M/mois':'1M/mois';}

async function refreshElevenQuota(s) {
  const box=document.getElementById('eleven-quota-box');if(!box)return;
  if(s.ttsProvider!=='elevenlabs'||!s.elevenApiKey){box.classList.add('hidden');return;}
  box.classList.remove('hidden');
  document.getElementById('eleven-quota-text').textContent='Chargement…';
  const info=await fetchElevenSubscription(s.elevenApiKey);
  if(!info?.ok){document.getElementById('eleven-quota-text').textContent=`Erreur quota (${info?.error||'?'})`;return;}
  const rem=Math.max(0,(info.character_limit||0)-(info.character_count||0));
  document.getElementById('eleven-quota-text').textContent=`${rem.toLocaleString('fr-FR')} caractères restants / ${Number(info.character_limit||0).toLocaleString('fr-FR')} — plan: ${info.tier||'?'}`;
  saveSettings({...s,elevenQuota:info});
}

// ── STORY TEXTS ───────────────────────────────────────────────────────────────
function storyTexts(story) {
  const t=[story.title,story.intro||''];
  for(const n of Object.values(story.nodes||{})) t.push(n.text||'',n.question||'');
  return t.filter(Boolean);
}
async function collectAllTexts(scope) {
  const stories=await getAllStories(),lib=await getLibrary();
  const storySelect=document.getElementById('input-offline-story');
  let texts=[];
  if(scope==='base') stories.filter(s=>!s.is_user_created).forEach(s=>texts.push(...storyTexts(s)));
  else if(scope==='library') lib.forEach(item=>{if(item?.story)texts.push(...storyTexts(item.story));});
  else if(scope==='all'){stories.forEach(s=>texts.push(...storyTexts(s)));lib.forEach(item=>{if(item?.story)texts.push(...storyTexts(item.story));});}
  else {
    const val=storySelect?.value||'';
    if(val.startsWith('story:')){const s=stories.find(x=>x.id===val.slice(6));if(s)texts=storyTexts(s);}
    if(val.startsWith('library:')){const item=lib.find(x=>String(x.id)===val.slice(8));if(item?.story)texts=storyTexts(item.story);}
  }
  return texts.filter(Boolean);
}

async function preCacheScope(scope){
  const texts=await collectAllTexts(scope);
  const result=await warmTtsCache(texts);
  await refreshCacheStatus();
  alert(`✅ Préchargement : ${result.stored} nouveau(x), ${result.skipped} déjà présent(s).`);
}

async function refreshCacheStatus() {
  const entries=await listAudioCacheEntries();
  const el=document.getElementById('offline-cache-status');
  if(el) el.textContent=`${entries.length} audio(s) en cache. Les éléments déjà présents ne sont pas regénérés.`;
}

async function refreshStorySelect() {
  const sel=document.getElementById('input-offline-story');if(!sel)return;
  const stories=await getAllStories(),lib=await getLibrary();
  const html=[];
  html.push('<optgroup label="Histoires de base">');
  stories.filter(s=>!s.is_user_created).forEach(s=>html.push(`<option value="story:${s.id}">${s.title}</option>`));
  html.push('</optgroup><optgroup label="Histoires personnalisées">');
  stories.filter(s=>s.is_user_created).forEach(s=>html.push(`<option value="story:${s.id}">${s.title}</option>`));
  html.push('</optgroup>');
  if(lib.length){html.push('<optgroup label="Bibliothèque">');lib.forEach((item,i)=>html.push(`<option value="library:${item.id??i}">${item.title||item.storyTitle||`Aventure ${i+1}`}</option>`));html.push('</optgroup>');}
  sel.innerHTML=html.join('');
}

// ── EXPORT MP3 ZIP ────────────────────────────────────────────────────────────

// ── Template histoire (pour IA / contributeurs) ──────────────────────────────
const STORY_TEMPLATE = {
  id:"mon-histoire",title:"Titre de l'histoire",cover_emoji:"🌟",
  intro:"Une courte phrase d'accroche.",start_node:"start",is_user_created:true,
  nodes:{
    start:{id:"start",headline:"Chapitre 1",cover_emoji:"🌟",
      text:"Paragraphe narratif (~200 mots). Décris la scène et introduis le personnage.",
      question:"Que choisis-tu ?",is_ending:false,choices:[
        {label:"Avancer",fallback_emoji:"🌟",next_node:"n1",is_original:true,is_learned:false,play_count:0},
        {label:"Attendre",fallback_emoji:"⏳",next_node:"n2",is_original:false,is_learned:false,play_count:0},
        {label:"Partir",fallback_emoji:"🏃",next_node:"end_a",is_original:false,is_learned:false,play_count:0}
      ]},
    n1:{id:"n1",headline:"Chapitre 2a",cover_emoji:"🌟",text:"Suite...",question:"Que fais-tu ?",is_ending:false,choices:[
      {label:"Continuer",fallback_emoji:"▶️",next_node:"end_a",is_original:true,is_learned:false,play_count:0},
      {label:"Revenir",fallback_emoji:"↩️",next_node:"start",is_original:false,is_learned:false,play_count:0}
    ]},
    n2:{id:"n2",headline:"Chapitre 2b",cover_emoji:"🌟",text:"Autre chemin...",question:"Et maintenant ?",is_ending:false,choices:[
      {label:"Rester",fallback_emoji:"🏠",next_node:"end_b",is_original:true,is_learned:false,play_count:0}
    ]},
    end_a:{id:"end_a",headline:"Fin heureuse",cover_emoji:"🎉",text:"Belle conclusion.",question:"",is_ending:true,choices:[]},
    end_b:{id:"end_b",headline:"Autre fin",cover_emoji:"😊",text:"Une autre conclusion.",question:"",is_ending:true,choices:[]},
  }
};

// ── Export ZIP COMPLET (données + cache audio) ────────────────────────────────
async function exportFullZip() {
  if(typeof JSZip==='undefined'){alert('JSZip non chargé. Vérifiez la connexion.');return;}
  const zip=new JSZip();
  // 1. Données (histoires + bibliothèque)
  const data=await exportAllData();
  zip.file('data.json',JSON.stringify(data,null,2));
  // 2. Cache audio complet (IDs + dataUrls)
  const audioEntries=await listAudioCacheEntries();
  if(audioEntries.length){
    zip.file('audio_cache.json',JSON.stringify(audioEntries,null,2));
    // Aussi exporter les MP3 séparément pour lisibilité
    const mp3folder=zip.folder('mp3');
    audioEntries.forEach((e,i)=>{
      if(!e.dataUrl)return;
      const b64=e.dataUrl.split(',')[1];
      const name=`${String(i).padStart(4,'0')}_${(e.id||'').replace(/[^a-z0-9_]/gi,'_').slice(0,60)}.mp3`;
      mp3folder.file(name,b64,{base64:true});
    });
  }
  zip.file('_meta.json',JSON.stringify({exportedAt:new Date().toISOString(),stories:data.stories?.length||0,library:data.library?.length||0,audioEntries:audioEntries.length},null,2));
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`conteur-backup-${new Date().toISOString().slice(0,10)}.zip`;a.click();
  logDebug('export.full.zip',{stories:data.stories?.length,audio:audioEntries.length});
}

// ── Import ZIP COMPLET ────────────────────────────────────────────────────────
async function importFullZip(file) {
  if(typeof JSZip==='undefined'){alert('JSZip non chargé.');return;}
  const zip=await JSZip.loadAsync(file);
  let storiesOk=0,audioOk=0;
  // 1. Données
  if(zip.files['data.json']){
    const text=await zip.files['data.json'].async('text');
    await importAllData(JSON.parse(text));
    storiesOk=1;
  }
  // 2. Cache audio
  if(zip.files['audio_cache.json']){
    const text=await zip.files['audio_cache.json'].async('text');
    const entries=JSON.parse(text);
    audioOk=await importCacheEntries(entries);
  }
  await refreshStorySelect();await refreshCacheStatus();
  alert(`✅ Import terminé :\n• ${storiesOk?'Données importées':'Pas de données'}\n• ${audioOk} audio(s) importé(s) en cache`);
  logDebug('import.full.zip',{storiesOk,audioOk});
}

// ── Export une histoire seule ────────────────────────────────────────────────
async function exportSingleStory(storyId) {
  const story=await exportStory(storyId);
  if(!story){alert('Histoire introuvable.');return;}
  const blob=new Blob([JSON.stringify(story,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`histoire-${story.id}.json`;a.click();
}

// ── Export template vierge ───────────────────────────────────────────────────
function exportStoryTemplate() {
  const blob=new Blob([JSON.stringify(STORY_TEMPLATE,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='histoire-template.json';a.click();
}

async function exportMp3Zip() {
  if(typeof JSZip==='undefined'){alert('JSZip non chargé.');return;}

  const entries=await listAudioCacheEntries();
  if(!entries.length){alert('Aucun audio en cache à exporter.');return;}
  // Use JSZip if available
  if(typeof JSZip==='undefined'){alert('JSZip non chargé. Vérifiez la connexion.');return;}
  const zip=new JSZip();
  entries.forEach((e,i)=>{
    if(!e.dataUrl)return;
    const b64=e.dataUrl.split(',')[1];
    const name=`audio_${String(i).padStart(4,'0')}_${(e.voiceKey||e.id||'').replace(/[^a-z0-9_]/gi,'_').slice(0,40)}.mp3`;
    zip.file(name,b64,{base64:true});
  });
  const meta={exportedAt:new Date().toISOString(),count:entries.length};
  zip.file('_index.json',JSON.stringify(meta,null,2));
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='conteur-audio-cache.zip';a.click();
  logDebug('export.mp3.zip',{count:entries.length});
}

// ── RENDER ────────────────────────────────────────────────────────────────────
export function renderParental() {
  setView('view-parental');
  const gate=document.getElementById('pin-gate');
  const content=document.getElementById('parental-content');
  content.classList.add('hidden');
  buildPinPad(gate,async()=>{
    gate.innerHTML='';content.classList.remove('hidden');
    bindTabs();
    const s=getSettings();
    // Accès
    document.getElementById('input-pin-edit').value=s.pin||'';
    // Histoire (LLM)
    document.getElementById('input-api-key').value=s.apiKey||'';
    document.getElementById('input-model').value=s.model||'llama-3.3-70b-versatile';
    // Voix – fournisseur
    document.getElementById('input-tts-provider').value=s.ttsProvider||'browser';
    // GCP
    document.getElementById('input-gcp-api-key').value=s.gcpApiKey||'';
    document.getElementById('input-gcp-voice-name').value=s.gcpVoiceName||'fr-FR-Wavenet-A';
    document.getElementById('input-gcp-voice-type').value=s.gcpVoiceType||'Wavenet';
    document.getElementById('input-gcp-language').value=s.gcpLanguage||'fr-FR';
    const rateSlider=document.getElementById('input-gcp-speaking-rate');
    const rateDisplay=document.getElementById('gcp-rate-display');
    if(rateSlider){rateSlider.value=s.gcpSpeakingRate??0.87;rateDisplay.textContent=Number(rateSlider.value).toFixed(2)+'×';
      rateSlider.oninput=()=>{
        const v=rateSlider.value,min=0.5,max=1.3;
        const pct=Math.round((v-min)/(max-min)*100);
        rateSlider.style.background=`linear-gradient(90deg,var(--color-accent,#4f98a3) ${pct}%,rgba(255,255,255,.18) ${pct}%)`;
        rateDisplay.textContent=Number(v).toFixed(2)+'×';};
      // init track color
      const v0=rateSlider.value,pct0=Math.round((v0-0.5)/(1.3-0.5)*100);
      rateSlider.style.background=`linear-gradient(90deg,var(--color-accent,#4f98a3) ${pct0}%,rgba(255,255,255,.18) ${pct0}%)`;
    }
    refreshGcpQuota(s);
    // OpenAI
    document.getElementById('input-openai-api-key').value=s.openaiApiKey||'';
    document.getElementById('input-openai-voice').value=s.openaiVoice||'nova';
    // ElevenLabs
    document.getElementById('input-eleven-api-key').value=s.elevenApiKey||'';
    document.getElementById('input-eleven-voice-id').value=s.elevenVoiceId||'';
    document.getElementById('input-eleven-model').value=s.elevenModel||'eleven_multilingual_v2';
    document.getElementById('input-eleven-format').value=s.elevenFormat||'mp3_44100_128';
    document.getElementById('input-eleven-force-fr').checked=s.elevenForceFrench!==false;
    // Debug
    document.getElementById('input-debug-enabled').checked=!!s.debugEnabled;
    // Offline
    await refreshStorySelect();await refreshCacheStatus();
    if(s.ttsProvider==='elevenlabs') await refreshElevenQuota(s);
  });

  document.getElementById('btn-parental-back').onclick=()=>renderHome();

  document.getElementById('btn-save-settings').onclick=async()=>{
    const next={
      ...getSettings(),
      pin:document.getElementById('input-pin-edit').value||getSettings().pin||'',
      apiKey:document.getElementById('input-api-key').value.trim(),
      model:document.getElementById('input-model').value,
      ttsProvider:document.getElementById('input-tts-provider').value,
      gcpApiKey:document.getElementById('input-gcp-api-key').value.trim(),
      gcpVoiceName:document.getElementById('input-gcp-voice-name').value.trim()||'fr-FR-Wavenet-A',
      gcpVoiceType:document.getElementById('input-gcp-voice-type').value,
      gcpLanguage:document.getElementById('input-gcp-language').value||'fr-FR',
      gcpSpeakingRate:parseFloat(document.getElementById('input-gcp-speaking-rate')?.value??0.87),
      openaiApiKey:document.getElementById('input-openai-api-key').value.trim(),
      openaiVoice:document.getElementById('input-openai-voice').value,
      elevenApiKey:document.getElementById('input-eleven-api-key').value.trim(),
      elevenVoiceId:document.getElementById('input-eleven-voice-id').value.trim(),
      elevenModel:document.getElementById('input-eleven-model').value,
      elevenFormat:document.getElementById('input-eleven-format').value,
      elevenForceFrench:document.getElementById('input-eleven-force-fr').checked,
      debugEnabled:document.getElementById('input-debug-enabled').checked,
      offlineCacheMode:document.getElementById('input-offline-mode').value,
    };
    saveSettings(next);
    refreshGcpQuota(next);
    if(next.ttsProvider==='elevenlabs') await refreshElevenQuota(next);
    logDebug('settings.saved',{ttsProvider:next.ttsProvider,model:next.model});
    alert('Paramètres enregistrés ✓');
  };

  document.getElementById('btn-export-full-zip').onclick=()=>exportFullZip();
  document.getElementById('import-full-zip').onchange=async e=>{const f=e.target.files?.[0];if(f)await importFullZip(f);e.target.value='';};
  document.getElementById('btn-export').onclick=async()=>{
    const blob=new Blob([JSON.stringify(await exportAllData(),null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='conteur-backup.json';a.click();
  };
  document.getElementById('btn-export-story-template').onclick=()=>exportStoryTemplate();
  document.getElementById('import-story-file').onchange=async e=>{
    const f=e.target.files?.[0];if(!f)return;
    const story=JSON.parse(await f.text());
    if(!story?.id||!story?.nodes){alert('JSON invalide : champs id et nodes requis.');return;}
    await importStory(story);await refreshStorySelect();alert(`Histoire "${story.title||story.id}" importée ✓`);
    e.target.value='';
  };
  document.getElementById('import-file').onchange=async e=>{
    const f=e.target.files?.[0];if(!f)return;
    await importAllData(JSON.parse(await f.text()));await refreshStorySelect();alert('Import terminé');
  };
  document.getElementById('btn-export-mp3-zip').onclick=()=>exportMp3Zip();
  document.getElementById('btn-precache-selected').onclick=()=>preCacheScope('selected');
  document.getElementById('btn-precache-base').onclick=()=>preCacheScope('base');
  document.getElementById('btn-precache-library').onclick=()=>preCacheScope('library');
  document.getElementById('btn-precache-all').onclick=()=>preCacheScope('all');
  document.getElementById('btn-clear-audio-cache').onclick=async()=>{await clearAudioCache();await refreshCacheStatus();alert('Cache audio vidé.');};
  document.getElementById('btn-download-debug').onclick=()=>downloadDebugTxt();
  document.getElementById('btn-clear-debug').onclick=()=>{clearDebugEntries();alert('Debug vidé.');};
  document.getElementById('btn-refresh-eleven-quota').onclick=async()=>{const s=getSettings();await refreshElevenQuota(s);};
}
