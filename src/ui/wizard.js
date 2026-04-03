import { saveStory } from '../storage/database.js';
import { state, setView } from '../core/state.js';
import { renderHome } from './carousel.js';

function buildStory(hero, world, goal) {
  const id = `custom_${Date.now()}`;
  return {
    id,
    title: `${hero} et ${goal}`,
    cover_emoji: '✨',
    duration_label: '10 min',
    intro: `${hero} part dans ${world} pour ${goal}.`,
    start_node: 'start',
    nodes: {
      start: {
        id: 'start', headline: world, cover_emoji: '✨',
        text: `${hero} entre dans ${world}. Très vite, une mission l'attend : ${goal}. Tout semble possible et l'aventure démarre immédiatement.`,
        question: 'Que faire ?',
        choices: [
          { label: 'Avancer', fallback_emoji: '🌟', next_node: 'n1', is_original: true },
          { label: 'Aider', fallback_emoji: '🤝', next_node: 'n2' },
          { label: 'Explorer', fallback_emoji: '🗺️', next_node: 'n3' }
        ]
      },
      n1: { id: 'n1', headline: 'Le passage', cover_emoji: '🌟', text: `${hero} avance courageusement et trouve un premier indice utile.`, question: '', is_ending: true, choices: [] },
      n2: { id: 'n2', headline: 'Le secours', cover_emoji: '🤝', text: `${hero} aide quelqu'un sur la route et reçoit en retour l'aide nécessaire pour finir la mission.`, question: '', is_ending: true, choices: [] },
      n3: { id: 'n3', headline: 'La découverte', cover_emoji: '🗺️', text: `${hero} explore un chemin secret et découvre une façon inattendue de réussir.`, question: '', is_ending: true, choices: [] }
    }
  };
}

export function renderWizard() {
  setView('view-wizard');
  document.getElementById('btn-wizard-back').onclick = () => renderHome();
  document.getElementById('btn-create-story').onclick = async () => {
    const hero = document.getElementById('wizard-hero').value.trim() || 'Milo';
    const world = document.getElementById('wizard-world').value.trim() || 'forêt magique';
    const goal = document.getElementById('wizard-goal').value.trim() || 'retrouver une lumière perdue';
    const story = buildStory(hero, world, goal);
    await saveStory(story);
    state.stories = [...state.stories, story];
    renderHome();
  };
}
