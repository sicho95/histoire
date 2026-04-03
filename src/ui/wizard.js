
import { generateNextNode } from '../api/router.js';
import { saveStory } from '../storage/database.js';
import { startStory, setView } from '../core/engine.js';

export const renderWizard = () => {
    const q = document.getElementById('wizard-question');
    const grid = document.getElementById('wizard-grid');
    q.textContent = "Qui sera le héros ?";
    grid.innerHTML = '';

    const heroes = [
        {e:'👦', l:'Garçon'}, {e:'👧', l:'Fille'}, {e:'🐶', l:'Chien'}, {e:'🤖', l:'Robot'}
    ];

    heroes.forEach(h => {
        const b = document.createElement('button');
        b.className = 'choice-tile';
        b.innerHTML = `<span class="choice-emoji">${h.e}</span><span class="choice-label">${h.l}</span>`;
        b.onclick = async () => {
            q.textContent = "Création magique en cours...";
            grid.innerHTML = '';
            const id = 'story_' + Date.now();
            try {
                const s = {
                    id, meta: { title: `L'aventure du ${h.l}`, cover_emoji: h.e },
                    nodes: { start: { id: 'start', text: `Un beau jour, un ${h.l} part à l'aventure.`, question: 'Que fait-il ?', choices: [{intent:'explorer', label:'Explorer', fallback_emoji:'🗺️', next_node:'n1', is_original:true}] },
                    n1: { id: 'n1', text: 'Il trouve un trésor et rentre chez lui heureux.', question: '', is_ending: true, choices:[] } }
                };
                await saveStory(s);
                startStory(id);
            } catch(e) { alert("Erreur: " + e.message); setView('view-home'); }
        };
        grid.appendChild(b);
    });
};
