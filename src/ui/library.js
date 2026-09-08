import { deleteDraft, getDrafts } from '../storage/database.js';
import { hasGenerationKey } from '../storage/settings.js';
import { startStory } from '../core/engine.js';
import { createStoryPackage, downloadBlob } from '../export/story-package.js';
import { showToast } from './toast.js';

let libraryPage = 0;

export function refreshCreationAvailability() {
  document.querySelector('.studio-callout')?.classList.toggle('hidden', !hasGenerationKey());
}

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
  refreshCreationAvailability();
  const drafts = (await getDrafts()).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const list = document.getElementById('draft-list');
  list.replaceChildren();
  if (!drafts.length) {
    list.innerHTML = `<div class="card"><h2>Aucune histoire personnelle</h2><p class="supporting">${hasGenerationKey() ? 'Les histoires inventées dans l’atelier apparaîtront ici.' : 'L’atelier sera proposé lorsqu’un parent aura configuré une clé Groq.'}</p></div>`;
    return;
  }
  const pageSize = window.innerHeight < 760 ? 1 : 2;
  const pages = Math.ceil(drafts.length / pageSize);
  libraryPage = Math.min(libraryPage, pages - 1);
  for (const draft of drafts.slice(libraryPage * pageSize, (libraryPage + 1) * pageSize)) {
    const card = document.createElement('article');
    card.className = 'draft-card';
    card.innerHTML = `<h2></h2><p></p><div class="draft-actions"><button class="secondary-button play">Lire</button><button class="secondary-button export">ZIP + voix</button><button class="text-button remove">Supprimer</button></div>`;
    card.querySelector('h2').textContent = `${draft.coverEmoji} ${draft.title}`;
    card.querySelector('p').textContent = `Histoire personnelle · ${draft.durationMinutes} min environ`;
    card.querySelector('.play').onclick = () => startStory(draft);
    card.querySelector('.export').onclick = async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const result = await createStoryPackage(draft, {
          onProgress: ({ current, total }) => { button.textContent = `Voix ${current}/${total}`; }
        });
        downloadBlob(result.blob, `${draft.id}-histoire-et-voix.zip`);
        showToast(result.missingCount
          ? `ZIP prêt avec le récit et ${result.audioCount} voix. ${result.missingCount} voix pourront être ajoutées plus tard.`
          : `ZIP complet prêt : histoire, relecture et ${result.audioCount} voix.`);
      } catch (error) { showToast(error.message); }
      finally { button.disabled = false; button.textContent = 'ZIP + voix'; }
    };
    card.querySelector('.remove').onclick = async () => {
      if (confirm('Supprimer cette histoire personnelle de cet appareil ?')) { await deleteDraft(draft.id); libraryPage = 0; renderLibrary(); }
    };
    list.append(card);
  }
  appendPager(list, libraryPage, pages);
}
