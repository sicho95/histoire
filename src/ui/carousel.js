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
  const groups = [
    { ageBand: '5-9', title: 'Grandes aventures · 5–9 ans', subtitle: 'Mystères, émotions et décisions qui changent vraiment le voyage.' },
    { ageBand: '2-5', title: 'Histoires douces · 2–5 ans', subtitle: 'Rythme calme, répétitions rassurantes et choix très visuels.' }
  ];
  for (const group of groups) {
    const groupStories = state.stories.filter(story => story.ageBand === group.ageBand).sort((a, b) => a.featuredOrder - b.featuredOrder);
    if (!groupStories.length) continue;
    const section = document.createElement('section');
    section.className = 'story-shelf';
    section.innerHTML = '<div class="story-shelf__heading"><h3></h3><p></p></div><div class="story-grid"></div>';
    section.querySelector('h3').textContent = group.title;
    section.querySelector('p').textContent = group.subtitle;
    const grid = section.querySelector('.story-grid');
    container.append(section);
    for (const story of groupStories) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'story-card';
    card.innerHTML = `${story.coverImage ? `<img class="story-card__cover" src="${story.coverImage}" alt="">` : `<span class="story-card__emoji">${story.coverEmoji}</span>`}<div class="story-card__body"><h3></h3><p></p><span class="story-card__meta"></span></div>`;
    card.querySelector('h3').textContent = story.title;
    card.querySelector('p').textContent = story.intro;
    card.querySelector('.story-card__meta').textContent = `${story.ageRange} · env. ${story.durationMinutes} min · 🔊 voix incluse`;
    card.onclick = () => startStory(story);
      grid.append(card);
    }
  }
}
