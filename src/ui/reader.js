
import { speak, stopSpeak } from '../audio/tts.js';
import { listen } from '../audio/stt.js';
import { filterChoices } from '../core/choices.js';
import { setView } from '../core/engine.js';
import { renderHome } from './carousel.js';

export const renderReader = (node, onChoice) => {
    document.getElementById('current-question').textContent = node.question;
    const grid = document.getElementById('choices-grid');
    grid.innerHTML = '';

    const btnSpeak = document.getElementById('btn-speak');
    btnSpeak.style.display = 'none';

    speak(node.text, () => {
        filterChoices(node.choices).forEach(c => {
            const b = document.createElement('button');
            b.className = 'choice-tile';
            b.innerHTML = `<span class="choice-emoji">${c.fallback_emoji}</span><span class="choice-label">${c.label}</span>`;
            b.onclick = () => onChoice(c.intent, false);
            grid.appendChild(b);
        });
        if (navigator.onLine) btnSpeak.style.display = 'flex';
    });

    document.getElementById('btn-repeat-question').onclick = () => speak(node.question);
    document.getElementById('btn-home').onclick = () => { stopSpeak(); renderHome(); setView('view-home'); };

    btnSpeak.onclick = () => {
        stopSpeak();
        btnSpeak.classList.add('listening');
        listen(t => { btnSpeak.classList.remove('listening'); onChoice(t, true); }, 
               e => { btnSpeak.classList.remove('listening'); console.error(e); });
    };
};
