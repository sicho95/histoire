import { state, setView } from '../core/state.js';
import { startStoryFromCarousel } from '../core/engine.js';
import { renderWizard } from './wizard.js';
function updateCardClasses(container) {
  const cards = [...container.querySelectorAll('.story-card')];
  if (!cards.length) return;
  const center = container.scrollLeft + container.clientWidth / 2;
  let active = 0, best = Infinity;
  cards.forEach((card, idx) => {
    const c = card.offsetLeft + card.offsetWidth / 2;
    const d = Math.abs(center - c);
    if (d < best) { best = d; active = idx; }
  });
  cards.forEach((card, idx) => {
    card.classList.toggle('is-active', idx === active);
    card.classList.toggle('is-before', idx === active - 1);
    card.classList.toggle('is-after', idx === active + 1);
  });
}
export function renderHome() {
  setView('view-home');
  const container = document.getElementById('story-carousel');
  const stories = [...state.stories, { id: '__new__', title: 'Nouvelle histoire', cover_emoji: '➕', duration_label: navigator.onLine ? 'Créer' : 'Hors ligne' }];
  container.innerHTML = '';
  stories.forEach(story => {
    const card = document.createElement('article');
    card.className = `story-card ${story.id === '__new__' ? 'story-card--new' : ''}`;
    card.innerHTML = `<button class="story-card__button" aria-label="${story.title}"><div class="story-card__art"><div class="story-card__emoji">${story.cover_emoji || '📖'}</div><div class="story-card__title">${story.title}</div><div class="story-card__meta">${story.duration_label || '10 à 15 min'}</div></div></button>`;
    card.querySelector('button').onclick = () => {
      if (story.id === '__new__') { if (navigator.onLine) renderWizard(); return; }
      startStoryFromCarousel(story);
    };
    container.appendChild(card);
  });
  const sync = () => updateCardClasses(container);
  container.onscroll = () => requestAnimationFrame(sync);
  requestAnimationFrame(sync);
}
