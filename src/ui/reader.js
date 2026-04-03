import { currentNode, state, setView } from '../core/state.js';
import { pickDisplayChoices } from '../core/choices.js';
import { chooseOption, replayQuestion, replayStory, speakQuestionOnly } from '../core/engine.js';
export function renderReader({ introOnly = false } = {}) {
  setView('view-reader');
  const node = currentNode();
  if (!node) return;
  document.getElementById('reader-story-title').textContent = state.currentStory.title;
  document.getElementById('reader-cover-emoji').textContent = node.cover_emoji || state.currentStory.cover_emoji || '📖';
  document.getElementById('reader-headline').textContent = introOnly ? state.currentStory.title : (node.headline || 'Écoute bien...');
  document.getElementById('reader-body').textContent = node.text || '';
  const panel = document.getElementById('question-panel');
  const questionEl = document.getElementById('current-question');
  const grid = document.getElementById('choices-grid');
  questionEl.textContent = node.question || '';
  document.getElementById('btn-repeat-question').onclick = () => speakQuestionOnly();
  document.getElementById('btn-back-home').onclick = () => { location.hash = '#home'; window.dispatchEvent(new Event('app:goHome')); };
  if (introOnly || !node.question) {
    panel.classList.add('hidden');
    grid.classList.add('hidden');
    grid.innerHTML = '';
    return;
  }
  panel.classList.remove('hidden');
  grid.classList.remove('hidden');
  const choices = pickDisplayChoices(node).slice(0, 3);
  grid.innerHTML = '';
  choices.forEach(choice => {
    const button = document.createElement('button');
    button.className = 'choice-card';
    button.innerHTML = `<div class="choice-card__emoji">${choice.fallback_emoji || '✨'}</div><div class="choice-card__label">${choice.label}</div><div class="choice-card__sub">Touchez pour choisir</div>`;
    button.onclick = () => chooseOption(choice);
    grid.appendChild(button);
  });
}
