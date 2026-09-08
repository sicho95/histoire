import { STORY_RESPONSE_SCHEMA, buildFullStoryRequest } from '../api/prompts.js';
import { queryStructured } from '../api/router.js';
import { getSecrets } from '../storage/settings.js';
import { saveDraft } from '../storage/database.js';
import { estimateDurationMinutes, normalizeStory, validateStory } from '../core/story-model.js';
import { startStory } from '../core/engine.js';
import { showToast } from './toast.js';

const HEROES = {
  female: [
    'une exploratrice intrépide', 'une petite dragonne curieuse', 'une vétérinaire des animaux magiques',
    'une astronaute inventrice', 'une apprentie sorcière bienveillante', 'une jeune dinosaure au grand cœur',
    'une détective malicieuse', 'une chevalière qui préfère réfléchir', 'une sirène exploratrice',
    'une petite androïde qui découvre les émotions'
  ],
  male: [
    'un explorateur intrépide', 'un petit dragon curieux', 'un vétérinaire des animaux magiques',
    'un astronaute inventeur', 'un apprenti sorcier bienveillant', 'un jeune dinosaure au grand cœur',
    'un détective malicieux', 'un chevalier qui préfère réfléchir', 'un triton explorateur',
    'un petit robot qui découvre les émotions'
  ]
};

export function initWizard() {
  let step = 0;
  const form = document.getElementById('studio-form');
  const gender = document.getElementById('studio-gender');
  const hero = document.getElementById('studio-hero');
  const renderHeroes = () => {
    const selected = hero.value;
    hero.replaceChildren(...HEROES[gender.value].map(label => new Option(label, label)));
    if (HEROES[gender.value].includes(selected)) hero.value = selected;
  };
  const resetStudio = () => {
    form.reset();
    renderHeroes();
    showStep(0);
  };
  const showStep = next => {
    step = Math.max(0, Math.min(2, next));
    document.querySelectorAll('[data-studio-step]').forEach(panel => panel.classList.toggle('hidden', Number(panel.dataset.studioStep) !== step));
    document.querySelectorAll('.studio-progress span').forEach((dot, index) => dot.classList.toggle('active', index <= step));
  };
  document.querySelectorAll('.studio-next').forEach(button => { button.onclick = () => showStep(step + 1); });
  document.querySelectorAll('.studio-prev').forEach(button => { button.onclick = () => showStep(step - 1); });
  gender.onchange = renderHeroes;
  renderHeroes();
  window.addEventListener('app:viewChanged', event => { if (event.detail?.id === 'view-studio') showStep(0); });
  showStep(0);
  form.onsubmit = async event => {
    event.preventDefault();
    const status = document.getElementById('studio-status');
    const button = document.getElementById('generate-story');
    if (!getSecrets().groqApiKey) {
      showToast('Un parent doit d’abord ajouter une clé Groq gratuite.');
      document.querySelector('[data-view="view-parents"]').click();
      return;
    }
    const input = {
      hero: document.getElementById('studio-hero').value,
      heroVoice: gender.value,
      name: document.getElementById('studio-name').value.trim(),
      place: document.getElementById('studio-place').value,
      theme: document.getElementById('studio-theme').value,
      wish: document.getElementById('studio-wish').value.trim(),
      age: Number(document.getElementById('studio-age').value),
      duration: Number(document.getElementById('studio-duration').value)
    };
    button.disabled = true;
    status.textContent = 'J’imagine les personnages, les vrais embranchements et plusieurs fins…';
    try {
      const request = buildFullStoryRequest(input);
      const { data } = await queryStructured({ name: 'complete_child_story', schema: STORY_RESPONSE_SCHEMA, ...request, maxOutputTokens: 12000 });
      const requestedAgeBand = input.age <= 4 ? '2-5' : '5-9';
      const story = normalizeStory({
        ...data,
        ageBand: requestedAgeBand,
        heroVoice: input.heroVoice,
        source: 'child-draft',
        status: 'draft'
      }, { source: 'child-draft' });
      story.durationMinutes = estimateDurationMinutes(story);
      const validation = validateStory(story);
      if (!validation.ok) throw new Error(`L’histoire générée doit être retouchée : ${validation.errors[0]}`);
      const saved = await saveDraft(story, input);
      status.textContent = 'Ton histoire est prête et reste privée sur cet appareil.';
      resetStudio();
      await startStory(saved);
    } catch (error) {
      status.textContent = error.message;
    } finally { button.disabled = false; }
  };
}
