
import { generateNextNode } from '../api/router.js';
import { saveStory } from '../storage/database.js';

export const weaveNode = async (story, currentNodeId, voiceInput) => {
    const currentNode = story.nodes[currentNodeId];
    const history = story.meta.title; // Simplifié

    const newJson = await generateNextNode(history, currentNode.text, voiceInput);
    const newNodeId = 'node_' + Date.now();

    story.nodes[newNodeId] = {
        id: newNodeId,
        text: newJson.text,
        question: newJson.question,
        is_ending: newJson.is_ending || false,
        choices: newJson.choices?.map(c => ({...c, is_learned: true})) || []
    };

    const intent = newJson.choices?.[0]?.intent || voiceInput;
    const label = newJson.choices?.[0]?.label || "Nouveau";
    const emoji = newJson.choices?.[0]?.fallback_emoji || "✨";

    currentNode.choices.push({
        intent, label, fallback_emoji: emoji, next_node: newNodeId, is_learned: true, play_count: 1
    });

    await saveStory(story);
    return newNodeId;
};
