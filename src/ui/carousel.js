import { state } from '../core/state.js';
import { startStory } from '../core/engine.js';

export function renderHome() {
  const container = document.getElementById('story-carousel');
  if (!container) return;
  container.replaceChildren();
  if (!state.stories.length) {
    container.innerHTML = '<div class="info-card"><span>📭</span><p>Aucune histoire n’est encore disponible. Connecte-toi une première fois pour charger la bibliothèque.</p></div>';
    return;
  }
  for (const story of state.stories) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'story-card';
    card.innerHTML = `<span class="story-card__emoji">${story.coverEmoji}</span><h3></h3><p></p><span class="story-card__meta"></span>`;
    card.querySelector('h3').textContent = story.title;
    card.querySelector('p').textContent = story.intro;
    card.querySelector('.story-card__meta').textContent = `${story.ageRange} · env. ${story.durationMinutes} min`;
    card.onclick = () => startStory(story);
    container.append(card);
  }
}
