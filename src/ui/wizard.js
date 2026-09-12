import { STORY_RESPONSE_SCHEMA, STORY_REVIEW_SCHEMA, buildFullStoryRequest, buildStoryReviewRequest, storyReviewChunks } from '../api/prompts.js';
import { queryStructured } from '../api/router.js';
import { getSecrets } from '../storage/settings.js';
import { saveDraft } from '../storage/database.js';
import { applyStoryReview, assessGeneratedStory, normalizeStory, validateStory } from '../core/story-model.js';
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

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForEditorialQuota(rateLimit, status, pass) {
  const elapsed = Date.now() - Number(rateLimit?.requestStartedAt || Date.now());
  const fallback = Math.max(0, 61000 - elapsed);
  const waitMs = Math.max(1500, Number(rateLimit?.resetMs || rateLimit?.retryAfterMs) || fallback) + 1500;
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const seconds = Math.max(1, Math.ceil((deadline - Date.now()) / 1000));
    status.textContent = `Je laisse le quota gratuit se reposer… Relecture ${pass} dans ${seconds} s.`;
    await wait(Math.min(1000, Math.max(0, deadline - Date.now())));
  }
}

function reviewInputTokens(request) {
  return Math.ceil((request.instructions.length + request.userInput.length + JSON.stringify(STORY_REVIEW_SCHEMA).length) / 4);
}

function reviewOutputBudget(request, duration) {
  const inputTokens = reviewInputTokens(request);
  const preferred = duration >= 18 ? 2400 : 3000;
  return Math.max(900, Math.min(preferred, 7600 - inputTokens));
}

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
      const generated = await queryStructured({
        name: 'complete_child_story',
        schema: STORY_RESPONSE_SCHEMA,
        ...request,
        maxOutputTokens: input.duration >= 18 ? 5200 : input.duration >= 10 ? 4800 : 4300,
        reasoningEffort: 'low',
        maxAttempts: 1,
        retryHint: 'Vérifie particulièrement storyBible : premise, theme, values, heroGoal, stakes et recurringObjects doivent toutes être présentes.',
        repair: candidate => normalizeStory(candidate),
        onRetry: () => { status.textContent = 'Je vérifie l’histoire et je répare un détail…'; }
      });
      const requestedAgeBand = input.age <= 4 ? '2-5' : '5-9';
      let story = normalizeStory({
        ...generated.data,
        ageBand: requestedAgeBand,
        heroVoice: input.heroVoice,
        source: 'child-draft',
        status: 'draft'
      }, { source: 'child-draft' });
      let quality = assessGeneratedStory(story, input);
      let rateLimit = generated.rateLimit;
      const chunks = storyReviewChunks(story);
      for (let index = 0; index < chunks.length; index += 1) {
        const nodeIds = chunks[index];
        let reviewRequest = buildStoryReviewRequest({ story, input, metrics: quality.metrics, pass: index + 1, nodeIds });
        if (reviewInputTokens(reviewRequest) > 6500 && nodeIds.length > 1) {
          const middle = Math.ceil(nodeIds.length / 2);
          chunks.splice(index, 1, nodeIds.slice(0, middle), nodeIds.slice(middle));
          index -= 1;
          continue;
        }
        const label = chunks.length > 1 ? `${index + 1}/${chunks.length}` : 'finale';
        await waitForEditorialQuota(rateLimit, status, label);
        status.textContent = `Je relis la durée, la cohérence et les émotions… ${chunks.length > 1 ? `Partie ${label}` : ''}`;
        reviewRequest = buildStoryReviewRequest({ story, input, metrics: quality.metrics, pass: label, nodeIds });
        const reviewed = await queryStructured({
          name: 'child_story_editorial_patches',
          schema: STORY_REVIEW_SCHEMA,
          ...reviewRequest,
          maxOutputTokens: reviewOutputBudget(reviewRequest, input.duration),
          reasoningEffort: 'medium',
          maxAttempts: 1
        });
        story = applyStoryReview(story, reviewed.data);
        quality = assessGeneratedStory(story, input);
        rateLimit = reviewed.rateLimit;
      }
      if (!quality.ok) {
        const keyNodeIds = Object.values(story.nodes).filter(node => node.choices.length || node.isEnding).map(node => node.id);
        await waitForEditorialQuota(rateLimit, status, 'de correction');
        status.textContent = 'J’améliore les dernières scènes encore trop faibles…';
        const repairRequest = buildStoryReviewRequest({ story, input, metrics: quality.metrics, pass: 'de correction', nodeIds: keyNodeIds });
        const repaired = await queryStructured({
          name: 'child_story_editorial_patches',
          schema: STORY_REVIEW_SCHEMA,
          ...repairRequest,
          maxOutputTokens: reviewOutputBudget(repairRequest, input.duration),
          reasoningEffort: 'medium',
          maxAttempts: 1
        });
        story = applyStoryReview(story, repaired.data);
        quality = assessGeneratedStory(story, input);
      }
      if (!quality.ok) throw new Error(`Cette version n’atteint pas encore la qualité demandée : ${quality.errors[0]}. Elle n’a pas été enregistrée. Attends environ une minute, puis touche de nouveau Créer : tes choix sont conservés.`);
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
