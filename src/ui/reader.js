import { currentNode, state, setView } from '../core/state.js';
import { pickDisplayChoices } from '../core/choices.js';
import { chooseOption, replayQuestion, pauseAudio } from '../core/engine.js';
export function renderReader({ mode = 'cover' } = {}) {
  setView('view-reader');
  const node = currentNode();
  if (!node) return;
  const panel = document.getElementById('question-panel');
  const grid = document.getElementById('choices-grid');
  document.getElementById('reader-story-title').textContent = state.currentStory?.title || '';
  document.getElementById('reader-cover-emoji').textContent = node.cover_emoji || state.currentStory?.cover_emoji || '📖';
  document.getElementById('reader-node-title').textContent = node.headline || state.currentStory?.title || 'Aventure';
  document.getElementById('current-question').textContent = node.question || 'Que choisis-tu ?';
  document.getElementById('btn-repeat-question').onclick = () => replayQuestion();
  document.getElementById('btn-pause').onclick = () => pauseAudio();
  document.getElementById('btn-back-home').onclick = () => window.dispatchEvent(new Event('app:goHome'));
  if (mode !== 'question' || !node.question) { panel.classList.add('hidden'); grid.classList.add('hidden'); grid.innerHTML = ''; return; }
  panel.classList.remove('hidden');
  grid.classList.remove('hidden');
  grid.innerHTML = '';
  pickDisplayChoices(node).slice(0,4).forEach(choice => {
    const button = document.createElement('button');
    button.className = 'choice-card';
    button.innerHTML = `<div class="choice-card__emoji">${choice.fallback_emoji || '✨'}</div><div class="choice-card__label">${choice.label}</div><div class="choice-card__sub">Touchez pour choisir</div>`;
    button.onclick = () => chooseOption(choice);
    grid.appendChild(button);
  });
}
