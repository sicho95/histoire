export const state = {
  stories: [],
  currentStory: null,
  currentNodeId: null,
  path: [],
  isOffline: !navigator.onLine
};
export const setView = id => {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');
};
export const currentNode = () => state.currentStory?.nodes?.[state.currentNodeId] || null;
