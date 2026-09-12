import { STORY_RESPONSE_SCHEMA, STORY_REVIEW_SCHEMA, buildFullStoryRequest, buildStoryExpansionRequest, buildStoryReviewRequest } from '../api/prompts.js';
import { queryStructured } from '../api/router.js';
import { getSecrets } from '../storage/settings.js';
import { saveDraft } from '../storage/database.js';
import { applyStoryReview, assessGeneratedStory, normalizeStory, storyExpansionBatches, storyExpansionTargets, validateStory } from '../core/story-model.js';
import { detectStoryIntent } from '../core/story-intent.js';
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

function outputBudget(request, preferred) {
  const inputTokens = reviewInputTokens(request);
  return Math.max(900, Math.min(preferred, 7600 - inputTokens));
}

function reviewSchema({ minimum = 1, maximum = 40 } = {}) {
  const schema = structuredClone(STORY_REVIEW_SCHEMA);
  schema.properties.patches.minItems = minimum;
  schema.properties.patches.maxItems = maximum;
  return schema;
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
        maxOutputTokens: input.duration >= 10 ? 5200 : 4500,
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
      for (let round = 1; round <= 2; round += 1) {
        const targets = storyExpansionTargets(story, input);
        if (!targets.length) break;
        const batches = storyExpansionBatches(targets);
        for (const [index, batch] of batches.entries()) {
          const label = `d’allongement ${index + 1}/${batches.length}`;
          await waitForEditorialQuota(rateLimit, status, label);
          status.textContent = `J’allonge précisément ${batch.length} scènes trop courtes…`;
          const expansionRequest = buildStoryExpansionRequest({ story, input, targets: batch });
          const expanded = await queryStructured({
            name: 'child_story_length_patches',
            schema: reviewSchema({ minimum: batch.length, maximum: batch.length }),
            ...expansionRequest,
            maxOutputTokens: outputBudget(expansionRequest, 4800),
            reasoningEffort: 'low',
            maxAttempts: 1,
            repair: candidate => candidate
          });
          story = applyStoryReview(story, expanded.data, {
            minimumWords: Object.fromEntries(batch.map(target => [target.nodeId, target.minWords]))
          });
          quality = assessGeneratedStory(story, input);
          rateLimit = expanded.rateLimit;
        }
      }
      const keyNodeIds = Object.values(story.nodes).filter(node => node.choices.length || node.isEnding).map(node => node.id);
      const reviewChunks = [keyNodeIds];
      for (let index = 0; index < reviewChunks.length; index += 1) {
        const nodeIds = reviewChunks[index];
        let reviewRequest = buildStoryReviewRequest({ story, input, metrics: quality.metrics, pass: 'finale', nodeIds });
        if (reviewInputTokens(reviewRequest) > 6500 && nodeIds.length > 1) {
          const middle = Math.ceil(nodeIds.length / 2);
          reviewChunks.splice(index, 1, nodeIds.slice(0, middle), nodeIds.slice(middle));
          index -= 1;
          continue;
        }
        const label = reviewChunks.length > 1 ? `finale ${index + 1}/${reviewChunks.length}` : 'finale';
        await waitForEditorialQuota(rateLimit, status, label);
        status.textContent = 'Je renforce la cohérence et les émotions sans raccourcir…';
        reviewRequest = buildStoryReviewRequest({ story, input, metrics: quality.metrics, pass: label, nodeIds });
        const reviewed = await queryStructured({
          name: 'child_story_editorial_patches',
          schema: reviewSchema({ minimum: detectStoryIntent(input).strongEmotion ? Math.min(5, nodeIds.length) : 1 }),
          ...reviewRequest,
          maxOutputTokens: outputBudget(reviewRequest, input.duration >= 18 ? 2400 : 3200),
          reasoningEffort: 'medium',
          maxAttempts: 1,
          repair: candidate => candidate
        });
        story = applyStoryReview(story, reviewed.data, { neverShorten: true });
        quality = assessGeneratedStory(story, input);
        rateLimit = reviewed.rateLimit;
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
