import { getLibrary, importLibraryAdventure } from '../storage/database.js';
import { setView } from '../core/state.js';
import { renderHome } from './carousel.js';
import { playLibraryAdventure } from '../core/engine.js';

function downloadJson(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

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
      article.innerHTML = `<h3>${item.title}</h3><p>${item.summary || ''}</p><p>${new Date(item.savedAt).toLocaleString('fr-FR')}</p><div class="row-actions"><button class="btn-primary">▶ Lire</button><button class="btn-secondary">📤 Exporter</button></div>`;
      const [readBtn, exportBtn] = article.querySelectorAll('button');
      readBtn.onclick = () => playLibraryAdventure(item);
      exportBtn.onclick = () => downloadJson(`${(item.title || 'aventure').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.json`, item);
      list.appendChild(article);
    });
  }
  document.getElementById('btn-library-back').onclick = () => renderHome();
  document.getElementById('library-import-file').onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await importLibraryAdventure(JSON.parse(text));
    await renderLibrary();
  };
}
