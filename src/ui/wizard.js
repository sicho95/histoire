
import { saveStory } from '../storage/database.js';
import { getSettings } from '../storage/settings.js';
import { state, setView } from '../core/state.js';
import { renderHome } from './carousel.js';
import { speak, stopSpeak } from '../audio/tts.js';
import { logDebug } from '../core/debug.js';
import { callLLM } from '../api/router.js';

const CHARACTERS = [
  { emoji:'👧', label:'Fille',  key:'une petite fille courageuse' },
  { emoji:'👦', label:'Garçon', key:'un petit garçon curieux' },
  { emoji:'🤖', label:'Robot',  key:'un robot explorateur' },
  { emoji:'🦊', label:'Animal', key:'un animal magique' },
  { emoji:'🧚', label:'Fée',    key:'une fée espiègle' },
  { emoji:'🦸', label:'Héros',  key:'un super-héros bienveillant' },
];
const PLACES = [
  { emoji:'🌲', label:'Forêt',   key:'une forêt enchantée' },
  { emoji:'🏰', label:'Château', key:'un château des nuages' },
  { emoji:'🌊', label:'Mer',     key:'les fonds marins brillants' },
  { emoji:'🚀', label:'Espace',  key:'une station spatiale lointaine' },
  { emoji:'🏙️', label:'Ville',   key:'une ville secrète miniature' },
  { emoji:'🍄', label:'Jardin',  key:'un jardin de champignons géants' },
];
const THEMES = [
  { emoji:'⚔️',  label:'Aventure', key:'une grande aventure pleine de surprises' },
  { emoji:'🤝',  label:'Amitié',   key:'une belle histoire d\'amitié' },
  { emoji:'🔍',  label:'Mystère',  key:'un mystère à résoudre' },
  { emoji:'✨',  label:'Magie',    key:'un voyage magique' },
  { emoji:'🦁',  label:'Courage',  key:'une épreuve de courage' },
  { emoji:'😄',  label:'Humour',   key:'une aventure pleine de rires' },
];

const RANDOM_NAMES = ['Milo','Léa','Sami','Noa','Inès','Élio','Zara','Théo','Lila','Axel'];

let chosen = {};
let currentStep = 0;

function pick(list) { return list[Math.floor(Math.random()*list.length)]; }
function randName() { return pick(RANDOM_NAMES); }

function buildPrompt() {
  const c=chosen;
  return `Tu es un conteur pour enfants de 4 à 8 ans. Crée une histoire interactive en français avec:
- Héros: ${c.char.key}, prénommé ${c.name}
- Lieu: ${c.place.key}
- Thème: ${c.theme.key}
- Structure: exactement 8 noeuds narratifs (start, n1..n7) + 3 fins (end_a, end_b, end_c)
- Chaque noeud: ~200 mots d'histoire, 1 question, 3 choix (labels: 1 seul mot)
- Un choix par noeud doit avoir "is_original": true
- Les fins: ~100 mots chacune, is_ending: true, choices: []

Réponds UNIQUEMENT avec un JSON valide (aucun texte avant ou après) de cette forme exacte:
{
  "id": "custom_${Date.now()}",
  "title": "...",
  "cover_emoji": "...",
  "intro": "...",
  "start_node": "start",
  "is_user_created": true,
  "nodes": {
    "start": {"id":"start","headline":"...","cover_emoji":"...","text":"...","question":"...","choices":[{"label":"...","fallback_emoji":"...","next_node":"n1","is_original":true},{"label":"...","fallback_emoji":"...","next_node":"n1"},{"label":"...","fallback_emoji":"...","next_node":"n1"}]},
    "n1": { ... },
    "n2": { ... },
    "n3": { ... },
    "n4": { ... },
    "n5": { ... },
    "n6": { ... },
    "n7": {"id":"n7","headline":"...","cover_emoji":"...","text":"...","question":"Quelle fin choisis-tu ?","choices":[{"label":"...","fallback_emoji":"...","next_node":"end_a","is_original":true},{"label":"...","fallback_emoji":"...","next_node":"end_b"},{"label":"...","fallback_emoji":"...","next_node":"end_c"}]},
    "end_a": {"id":"end_a","headline":"...","cover_emoji":"...","text":"...","question":"","is_ending":true,"choices":[]},
    "end_b": {"id":"end_b","headline":"...","cover_emoji":"...","text":"...","question":"","is_ending":true,"choices":[]},
    "end_c": {"id":"end_c","headline":"...","cover_emoji":"...","text":"...","question":"","is_ending":true,"choices":[]}
  }
}`;
}

function el(id) { return document.getElementById(id); }

function showStep(n) {
  currentStep = n;
  document.querySelectorAll('.wz-step').forEach(s=>s.classList.toggle('hidden', s.dataset.step!=n));
}

function renderGrid(containerId, items, onPick) {
  const c = el(containerId);
  c.innerHTML = '';
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'wz-tile';
    btn.innerHTML = `<span class="wz-emoji">${item.emoji}</span><span class="wz-word">${item.label}</span>`;
    btn.onclick = () => { stopSpeak(); onPick(item); };
    c.appendChild(btn);
  });
}

function addRandom(containerId, items, onPick) {
  const c = el(containerId);
  const btn = document.createElement('button');
  btn.className = 'wz-tile wz-tile--random';
  btn.innerHTML = `<span class="wz-emoji">🎲</span><span class="wz-word">Au hasard</span>`;
  btn.onclick = () => { stopSpeak(); onPick(pick(items)); };
  c.appendChild(btn);
  const btn2 = document.createElement('button');
  btn2.className = 'wz-tile wz-tile--autre';
  btn2.innerHTML = `<span class="wz-emoji">💭</span><span class="wz-word">Autre</span>`;
  btn2.onclick = () => {
    stopSpeak();
    const input = el('wz-custom-input');
    if(input) { input.classList.toggle('hidden'); input.focus(); }
  };
  c.appendChild(btn2);
}

async function startGeneration() {
  showStep(4);
  el('wz-gen-status').textContent = 'Création de ton histoire… ✨';
  speak('Je crée ton histoire, attends une petite seconde…');
  try {
    const prompt = buildPrompt();
    logDebug('wizard.prompt', { prompt: prompt.slice(0, 300) });
    const raw = await callLLM(prompt, getSettings());
    const jsonStr = raw.replace(/^```json?\n?/,'').replace(/```$/,'').trim();
    const story = JSON.parse(jsonStr);
    story.id = story.id || `custom_${Date.now()}`;
    await saveStory(story);
    state.stories = [...(state.stories||[]).filter(s=>s.id!==story.id), story];
    speak(`Ton histoire est prête ! ${story.title}`);
    setTimeout(() => renderHome(), 1800);
  } catch(e) {
    logDebug('wizard.error', { msg: String(e) });
    el('wz-gen-status').textContent = '❌ Erreur de génération. Vérifie ta clé API dans les paramètres parents.';
    speak('Oups, quelque chose a raté. Vérifie la connexion et réessaie.');
  }
}

export function renderWizard() {
  setView('view-wizard');
  chosen = {};
  showStep(0);

  // Step 0 → welcome
  el('btn-wz-start').onclick = () => {
    showStep(1);
    renderGrid('wz-char-grid', CHARACTERS, item => { chosen.char=item; showStep('1b'); el('wz-char-name').value=''; el('wz-char-chosen').textContent=item.emoji; speak(`Tu as choisi : ${item.label}. Quel est son prénom ?`); });
    addRandom('wz-char-grid', CHARACTERS, item => { chosen.char=item; showStep('1b'); el('wz-char-name').value=''; el('wz-char-chosen').textContent=item.emoji; speak(`Au hasard : ${item.label}. Quel est son prénom ?`); });
    speak('Choisis ton personnage !');
  };

  // Step 1b → name
  el('btn-wz-name-confirm').onclick = () => {
    const v = el('wz-char-name').value.trim();
    chosen.name = v || randName();
    speak(`Super, ${chosen.name} ! Maintenant choisis un lieu.`);
    showStep(2);
    renderGrid('wz-place-grid', PLACES, item => { chosen.place=item; speak(`${item.label} ! Choisis maintenant le thème.`); showStep(3); renderGrid('wz-theme-grid', THEMES, theme => { chosen.theme=theme; speak(`${theme.label} ! Parfait !`); setTimeout(()=>startGeneration(), 600); }); addRandom('wz-theme-grid', THEMES, theme => { chosen.theme=theme; speak(`${theme.label} au hasard !`); setTimeout(()=>startGeneration(), 600); }); });
    addRandom('wz-place-grid', PLACES, item => { chosen.place=item; speak(`${item.label} au hasard ! Maintenant le thème.`); showStep(3); renderGrid('wz-theme-grid', THEMES, theme => { chosen.theme=theme; setTimeout(()=>startGeneration(), 600); }); addRandom('wz-theme-grid', THEMES, theme => { chosen.theme=theme; setTimeout(()=>startGeneration(), 600); }); });
  };
  el('btn-wz-name-rand').onclick = () => { el('wz-char-name').value=randName(); };

  el('btn-wizard-back').onclick = () => { stopSpeak(); renderHome(); };
}
