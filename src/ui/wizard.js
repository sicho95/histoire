import { STORY_RESPONSE_SCHEMA, buildFullStoryRequest, buildStoryRefinementRequest } from '../api/prompts.js';
import { queryStructured } from '../api/router.js';
import { getSecrets } from '../storage/settings.js';
import { saveDraft } from '../storage/database.js';
import { assessGeneratedStory, normalizeStory, storyPathMetrics, validateStory } from '../core/story-model.js';
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
  const status = document.getElementById('studio-status');
  const button = document.getElementById('generate-story');
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
    if (!button.disabled) status.textContent = '';
    document.querySelectorAll('[data-studio-step]').forEach(panel => panel.classList.toggle('hidden', Number(panel.dataset.studioStep) !== step));
    document.querySelectorAll('.studio-progress span').forEach((dot, index) => dot.classList.toggle('active', index <= step));
  };
  document.querySelectorAll('.studio-next').forEach(button => { button.onclick = () => showStep(step + 1); });
  document.querySelectorAll('.studio-prev').forEach(button => { button.onclick = () => showStep(step - 1); });
  form.addEventListener('input', () => { if (!button.disabled) status.textContent = ''; });
  gender.onchange = renderHeroes;
  renderHeroes();
  window.addEventListener('app:viewChanged', event => { if (event.detail?.id === 'view-studio') showStep(0); });
  showStep(0);
  form.onsubmit = async event => {
    event.preventDefault();
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
      const { data } = await queryStructured({
        name: 'complete_child_story',
        schema: STORY_RESPONSE_SCHEMA,
        ...request,
        maxOutputTokens: 12000,
        retryHint: 'Vérifie particulièrement storyBible : premise, theme, values, heroGoal, stakes et recurringObjects doivent toutes être présentes.',
        repair: candidate => normalizeStory(candidate),
        onRetry: () => { status.textContent = 'Je vérifie l’histoire et je répare un détail…'; }
      });
      const requestedAgeBand = input.age <= 4 ? '2-5' : '5-9';
      let story = normalizeStory({
        ...data,
        ageBand: requestedAgeBand,
        heroVoice: input.heroVoice,
        source: 'child-draft',
        status: 'draft'
      }, { source: 'child-draft' });
      let metrics = storyPathMetrics(story);
      const emotionalIntent = /émotion|trag|pleur|trist|boulevers|touchant|touchée|touché/.test(`${input.theme} ${input.wish}`.toLocaleLowerCase('fr'));
      if (input.wish || emotionalIntent || metrics.minMinutes < input.duration * .92 || metrics.maxMinutes > input.duration * 1.08) {
        status.textContent = input.wish || emotionalIntent
          ? 'Je fais une vraie passe d’émotion et je vérifie les dix minutes…'
          : 'J’allonge chaque chemin pour respecter la durée choisie…';
        const refinement = buildStoryRefinementRequest({ story, input, metrics });
        const refined = await queryStructured({
          name: 'refined_child_story',
          schema: STORY_RESPONSE_SCHEMA,
          ...refinement,
          maxOutputTokens: 16000,
          retryHint: 'Conserve toutes les clés de storyBible et tous les champs de chaque scène.',
          repair: candidate => normalizeStory(candidate),
          onRetry: () => { status.textContent = 'Je relis une dernière fois la durée et les émotions…'; }
        });
        story = normalizeStory({
          ...refined.data,
          ageBand: requestedAgeBand,
          heroVoice: input.heroVoice,
          source: 'child-draft',
          status: 'draft'
        }, { source: 'child-draft' });
        metrics = storyPathMetrics(story);
      }
      const quality = assessGeneratedStory(story, input);
      if (!quality.ok) throw new Error(`La relecture automatique demande encore une amélioration : ${quality.errors[0]}. L’histoire n’a pas été enregistrée ; relance la création pour obtenir une version complète.`);
      story.durationMinutes = input.duration;
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
