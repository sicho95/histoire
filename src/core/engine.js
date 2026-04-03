
import { getStory } from '../storage/database.js';
import { renderReader } from '../ui/reader.js';
import { renderEndScreen } from '../ui/end_screen.js';
import { weaveNode } from './weaver.js';

let activeStory = null;
let currentNode = null;
export let currentSession = [];

export const setView = id => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};

export const startStory = async (id) => {
    activeStory = await getStory(id);
    currentSession = [];
    playNode('start');
    setView('view-reader');
};

export const playNode = async (nodeId) => {
    currentNode = activeStory.nodes[nodeId];
    currentSession.push(currentNode);

    if (currentNode.is_ending || !currentNode.choices || currentNode.choices.length === 0) {
        renderEndScreen(activeStory, currentSession);
        setView('view-end');
    } else {
        renderReader(currentNode, handleChoice);
    }
};

const handleChoice = async (intent, isVoice) => {
    let nextNodeId = null;
    const choice = currentNode.choices.find(c => c.intent === intent);

    if (choice && choice.next_node) {
        choice.play_count = (choice.play_count || 0) + 1;
        nextNodeId = choice.next_node;
    } else if (isVoice && navigator.onLine) {
        try {
            document.getElementById('current-question').textContent = "L'histoire s'écrit...";
            nextNodeId = await weaveNode(activeStory, currentNode.id, intent);
        } catch (e) {
            alert("Erreur de magie: " + e.message);
            // On rafraichit la vue pour enlever le "L'histoire s'écrit"
            renderReader(currentNode, handleChoice);
            return;
        }
    } else if (choice) {
        alert("Ce chemin n'est pas encore écrit, il faut internet !");
        return;
    }

    if (nextNodeId) playNode(nextNodeId);
};
