
import { initDB, getAllStories } from './storage/database.js';
import { renderHome } from './ui/carousel.js';
import { setupParental } from './ui/parental.js';
import { renderLibrary } from './ui/library.js';
import { setView } from './core/engine.js';

document.addEventListener('DOMContentLoaded', async () => {
    await initDB();

    const stories = await getAllStories();
    if (stories.length === 0) {
        const res = await fetch('assets/default_stories.json');
        const data = await res.json();
        for (const s of data.stories) {
            await import('./storage/database.js').then(m => m.saveStory(s));
        }
    }

    window.addEventListener('online', () => document.body.classList.remove('offline'));
    window.addEventListener('offline', () => document.body.classList.add('offline'));
    if (!navigator.onLine) document.body.classList.add('offline');

    setupParental();
    document.getElementById('btn-library').onclick = () => { renderLibrary(); setView('view-library'); };

    renderHome();
});
