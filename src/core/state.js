export const state = {
  stories: [],
  currentStory: null,
  currentNodeId: null,
  path: [],
  isNarrating: false,
  readerPhase: 'narration'
};

export function setView(id) {
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('hidden', view.id !== id));
  document.querySelectorAll('.bottom-nav button').forEach(button => button.classList.toggle('active', button.dataset.view === id));
  document.querySelector('.bottom-nav')?.classList.toggle('hidden', id === 'view-reader');
  document.querySelector('.topbar')?.classList.toggle('hidden', id === 'view-reader');
  document.body.dataset.view = id;
  document.getElementById(id)?.scrollTo?.({ top: 0 });
  window.dispatchEvent(new CustomEvent('app:viewChanged', { detail: { id } }));
}

export const currentNode = () => state.currentStory?.nodes?.[state.currentNodeId] || null;
