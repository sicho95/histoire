
import { saveToLibrary } from '../storage/database.js';
import { speak } from '../audio/tts.js';
import { renderHome } from './carousel.js';
import { setView } from '../core/engine.js';

export const renderEndScreen = (story, session) => {
    speak("Bravo, tu as terminé l'aventure !");
    document.getElementById('btn-save-adventure').onclick = async () => {
        await saveToLibrary({ title: story.meta.title, date: new Date().toISOString(), nodes: session });
        alert("Sauvegardé dans la bibliothèque !");
        renderHome();
        setView('view-home');
    };
};
