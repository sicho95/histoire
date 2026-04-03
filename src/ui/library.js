import { getLibrary } from '../storage/database.js';
import { setView } from '../core/state.js';
import { renderHome } from './carousel.js';
export async function renderLibrary() {
  setView('view-library');
  const list = document.getElementById('library-list');
  const items = (await getLibrary()).reverse();
  if (!items.length) {
    list.innerHTML = '<div class="library-card"><h3>Aucune aventure gardée</h3><p>Termine une histoire puis appuie sur “Garder cette aventure”.</p></div>';
  } else {
    list.innerHTML = '';
    items.forEach(item => {
      const article = document.createElement('article');
      article.className = 'library-card';
      article.innerHTML = `<h3>${item.title}</h3><p>${item.summary}</p><p>${new Date(item.savedAt).toLocaleString('fr-FR')}</p>`;
      list.appendChild(article);
    });
  }
  document.getElementById('btn-library-back').onclick = () => { renderHome(); setView('view-home'); };
}
