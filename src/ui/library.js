
import { getLibrary } from '../storage/database.js';
import { setView } from '../core/engine.js';

export const renderLibrary = async () => {
    const list = document.getElementById('library-list');
    list.innerHTML = '';
    const libs = await getLibrary();
    libs.forEach(l => {
        const d = document.createElement('div');
        d.className = 'list-item';
        d.innerHTML = `<span>${l.title} (${new Date(l.date).toLocaleDateString()})</span>
                       <div><button class="btn-primary" onclick="alert('Lecture linéaire: ${l.nodes.length} noeuds')">▶ Lire</button></div>`;
        list.appendChild(d);
    });
};
