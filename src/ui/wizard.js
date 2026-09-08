import { STORY_RESPONSE_SCHEMA, buildFullStoryRequest } from '../api/prompts.js';
import { queryStructured } from '../api/router.js';
import { getSecrets } from '../storage/settings.js';
import { saveDraft } from '../storage/database.js';
import { estimateDurationMinutes, normalizeStory, validateStory } from '../core/story-model.js';
import { startStory } from '../core/engine.js';
import { showToast } from './toast.js';

export function initWizard() {
  let step = 0;
  const showStep = next => {
    step = Math.max(0, Math.min(2, next));
    document.querySelectorAll('[data-studio-step]').forEach(panel => panel.classList.toggle('hidden', Number(panel.dataset.studioStep) !== step));
    document.querySelectorAll('.studio-progress span').forEach((dot, index) => dot.classList.toggle('active', index <= step));
  };
  document.querySelectorAll('.studio-next').forEach(button => { button.onclick = () => showStep(step + 1); });
  document.querySelectorAll('.studio-prev').forEach(button => { button.onclick = () => showStep(step - 1); });
  window.addEventListener('app:viewChanged', event => { if (event.detail?.id === 'view-studio') showStep(0); });
  showStep(0);
  document.getElementById('studio-form').onsubmit = async event => {
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
      const story = normalizeStory({ ...data, source: 'child-draft', status: 'draft' }, { source: 'child-draft' });
      story.durationMinutes = estimateDurationMinutes(story);
      const validation = validateStory(story);
      if (!validation.ok) throw new Error(`L’histoire générée doit être retouchée : ${validation.errors[0]}`);
      const saved = await saveDraft(story, input);
      status.textContent = 'Ton histoire est prête et reste privée sur cet appareil.';
      await startStory(saved);
    } catch (error) {
      status.textContent = error.message;
    } finally { button.disabled = false; }
  };
}
