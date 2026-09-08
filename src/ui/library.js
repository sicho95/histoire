import { deleteDraft, getDrafts, getLibrary } from '../storage/database.js';
import { startStory } from '../core/engine.js';
import { createStoryPackage, downloadBlob } from '../export/story-package.js';
import { showToast } from './toast.js';

let libraryPage = 0;

function appendPager(list, page, pages) {
  if (pages < 2) return;
  const pager = document.createElement('div');
  pager.className = 'library-pager';
  pager.innerHTML = '<button class="secondary-button previous" type="button">←</button><span></span><button class="secondary-button next" type="button">→</button>';
  pager.querySelector('span').textContent = `${page + 1} / ${pages}`;
  pager.querySelector('.previous').disabled = page === 0;
  pager.querySelector('.next').disabled = page === pages - 1;
  pager.querySelector('.previous').onclick = () => { libraryPage -= 1; renderLibrary(); };
  pager.querySelector('.next').onclick = () => { libraryPage += 1; renderLibrary(); };
  list.append(pager);
}

export async function renderLibrary() {
  const drafts = (await getDrafts()).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const adventures = (await getLibrary()).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  const items = [...drafts.map(value => ({ type: 'draft', value })), ...adventures.map(value => ({ type: 'adventure', value }))];
  const list = document.getElementById('draft-list');
  list.replaceChildren();
  if (!items.length) {
    list.innerHTML = '<div class="card"><h2>Pas encore de création</h2><p class="supporting">Les histoires inventées dans l’atelier apparaîtront ici.</p></div>';
    return;
  }
  const pageSize = window.innerHeight < 760 ? 1 : 2;
  const pages = Math.ceil(items.length / pageSize);
  libraryPage = Math.min(libraryPage, pages - 1);
  for (const item of items.slice(libraryPage * pageSize, (libraryPage + 1) * pageSize)) {
    if (item.type === 'draft') {
      const draft = item.value;
      const card = document.createElement('article');
      card.className = 'draft-card';
      card.innerHTML = `<h2></h2><p></p><div class="draft-actions"><button class="secondary-button play">Lire</button><button class="secondary-button export">ZIP + voix</button><button class="text-button remove">Supprimer</button></div>`;
      card.querySelector('h2').textContent = `${draft.coverEmoji} ${draft.title}`;
      card.querySelector('p').textContent = `Brouillon privé · ${draft.durationMinutes} min environ`;
      card.querySelector('.play').onclick = () => startStory(draft);
      card.querySelector('.export').onclick = async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          const blob = await createStoryPackage(draft, {
            onProgress: ({ current, total }) => { button.textContent = `Voix ${current}/${total}`; }
          });
          downloadBlob(blob, `${draft.id}-histoire-et-voix.zip`);
          showToast('ZIP complet prêt : histoire, relecture et tous les MP3.');
        } catch (error) { showToast(error.message); }
        finally { button.disabled = false; button.textContent = 'ZIP + voix'; }
      };
      card.querySelector('.remove').onclick = async () => {
        if (confirm('Supprimer ce brouillon de cet appareil ?')) { await deleteDraft(draft.id); libraryPage = 0; renderLibrary(); }
      };
      list.append(card);
    } else {
      const adventure = item.value;
      const card = document.createElement('article');
      card.className = 'draft-card';
      card.innerHTML = '<h2></h2><p></p>';
      card.querySelector('h2').textContent = `🌟 ${adventure.title}`;
      card.querySelector('p').textContent = `${Math.max(1, (adventure.path || []).length - 1)} choix · gardé le ${new Date(adventure.savedAt).toLocaleDateString('fr-FR')}`;
      list.append(card);
    }
  }
  appendPager(list, libraryPage, pages);
}
