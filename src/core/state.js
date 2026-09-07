export const state = {
  stories: [],
  currentStory: null,
  currentNodeId: null,
  path: [],
  isNarrating: false
};

export function setView(id) {
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('hidden', view.id !== id));
  document.querySelectorAll('.bottom-nav button').forEach(button => button.classList.toggle('active', button.dataset.view === id));
  document.querySelector('.bottom-nav')?.classList.toggle('hidden', id === 'view-reader');
  document.querySelector('.topbar')?.classList.toggle('hidden', id === 'view-reader');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  window.dispatchEvent(new CustomEvent('app:viewChanged', { detail: { id } }));
}

export const currentNode = () => state.currentStory?.nodes?.[state.currentNodeId] || null;
