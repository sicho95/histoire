import { deleteDraft, exportDraftForReview, getDrafts, getLibrary } from '../storage/database.js';
import { startStory } from '../core/engine.js';
import { downloadJson } from './parental.js';
import { showToast } from './toast.js';

export async function renderLibrary() {
  const drafts = (await getDrafts()).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const adventures = (await getLibrary()).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  const list = document.getElementById('draft-list');
  list.replaceChildren();
  if (!drafts.length && !adventures.length) {
    list.innerHTML = '<div class="card"><h2>Pas encore de création</h2><p class="supporting">Les histoires inventées dans l’atelier apparaîtront ici.</p></div>';
    return;
  }
  if (drafts.length) {
    const heading = document.createElement('h2');
    heading.textContent = 'Histoires inventées';
    list.append(heading);
  }
  for (const draft of drafts) {
    const card = document.createElement('article');
    card.className = 'draft-card';
    card.innerHTML = `<h2></h2><p></p><div class="draft-actions"><button class="secondary-button play">Lire</button><button class="secondary-button export">Préparer la révision</button><button class="text-button remove">Supprimer</button></div>`;
    card.querySelector('h2').textContent = `${draft.coverEmoji} ${draft.title}`;
    card.querySelector('p').textContent = `Brouillon privé · ${draft.durationMinutes} min environ`;
    card.querySelector('.play').onclick = () => startStory(draft);
    card.querySelector('.export').onclick = async () => {
      downloadJson(await exportDraftForReview(draft.id), `${draft.id}-a-relire.json`);
      showToast('Dossier prêt. Tu peux maintenant me le confier ici pour la révision et les MP3.');
    };
    card.querySelector('.remove').onclick = async () => { if (confirm('Supprimer ce brouillon de cet appareil ?')) { await deleteDraft(draft.id); renderLibrary(); } };
    list.append(card);
  }
  if (adventures.length) {
    const heading = document.createElement('h2');
    heading.textContent = 'Fins déjà découvertes';
    list.append(heading);
    for (const adventure of adventures) {
      const card = document.createElement('article');
      card.className = 'draft-card';
      card.innerHTML = '<h2></h2><p></p>';
      card.querySelector('h2').textContent = `🌟 ${adventure.title}`;
      card.querySelector('p').textContent = `${Math.max(1, (adventure.path || []).length - 1)} choix · gardé le ${new Date(adventure.savedAt).toLocaleDateString('fr-FR')}`;
      list.append(card);
    }
  }
}
