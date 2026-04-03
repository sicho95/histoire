
import { getAllStories } from '../storage/database.js';
import { startStory, setView } from '../core/engine.js';
import { renderWizard } from './wizard.js';

export const renderHome = async () => {
    const stories = await getAllStories();
    const container = document.getElementById('story-carousel');
    container.innerHTML = '';

    stories.forEach(s => {
        const d = document.createElement('div');
        d.className = 'story-card';
        d.innerHTML = `<div class="emoji-cover">${s.meta.cover_emoji}</div><h3>${s.meta.title}</h3>`;
        d.onclick = () => startStory(s.id);
        container.appendChild(d);
    });

    const btnNew = document.getElementById('btn-new-story');
    btnNew.disabled = !navigator.onLine;
    btnNew.onclick = () => { renderWizard(); setView('view-wizard'); };
};
