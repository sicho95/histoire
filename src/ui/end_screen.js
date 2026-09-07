import { currentNode, setView, state } from '../core/state.js';

export function renderEndScreen() {
  const node = currentNode();
  document.getElementById('end-emoji').textContent = node?.coverEmoji || '🌟';
  document.getElementById('end-title').textContent = node?.headline || 'Bravo !';
  document.getElementById('end-summary').textContent = `Tu as fait ${Math.max(1, state.path.length - 1)} choix pour arriver jusqu’ici. Tu peux rejouer : un autre chemin donnera une autre fin.`;
  setView('view-end');
}
