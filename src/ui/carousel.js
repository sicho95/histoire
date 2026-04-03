import { state } from '../core/state.js';
import { startStoryFromCarousel } from '../core/engine.js';
let index = 0;
export function renderHome() {
  const container = document.getElementById('story-carousel');
  const stories = [...state.stories, { id: '__new__', title: 'Nouvelle histoire', cover_emoji: '➕', duration_label: 'Bientôt' }];
  container.innerHTML = '<div class="carousel-viewport"></div>';
  const viewport = container.firstElementChild;
  stories.forEach((story, i) => {
    const card = document.createElement('article');
    card.className = `story-card ${story.id === '__new__' ? 'story-card--new' : ''}`;
    card.innerHTML = `
      <button class="story-card__button" aria-label="${story.title}">
        <div class="story-card__art">
          <div class="story-card__emoji">${story.cover_emoji || '📖'}</div>
          <div class="story-card__title">${story.title}</div>
          <div class="story-card__meta">${story.duration_label || '10 à 15 min'}</div>
        </div>
      </button>`;
    card.querySelector('button').onclick = () => {
      if (story.id === '__new__') return;
      index = i;
      layout(stories);
      startStoryFromCarousel(story);
    };
    viewport.appendChild(card);
  });
  const move = delta => { index = (index + delta + state.stories.length) % state.stories.length; layout(stories); };
  document.getElementById('carousel-prev').onclick = () => move(-1);
  document.getElementById('carousel-next').onclick = () => move(1);
  layout(stories);
}
function layout(stories) {
  const cards = [...document.querySelectorAll('.story-card')];
  cards.forEach((card, i) => {
    const total = state.stories.length || 1;
    const offset = i - index;
    const x = offset * 34;
    const z = Math.max(0, 220 - Math.abs(offset) * 90);
    const rot = offset * -18;
    const scale = i === index ? 1 : Math.max(.72, 1 - Math.abs(offset) * .12);
    const alpha = i === index ? 1 : Math.max(.15, 1 - Math.abs(offset) * .32);
    if (i >= total && i !== total) return;
    card.style.transform = `translate(-50%, -50%) translateX(${x}%) translateZ(${z}px) rotateY(${rot}deg) scale(${scale})`;
    card.style.opacity = alpha;
    card.style.zIndex = 100 - Math.abs(offset);
    card.style.filter = i === index ? 'none' : 'saturate(.65) blur(.25px)';
    card.style.pointerEvents = Math.abs(offset) > 2 ? 'none' : 'auto';
  });
}
