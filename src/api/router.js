
import { getSettings } from '../storage/settings.js';
import { buildPrompt } from './prompts.js';

export async function generateNextNode(history, current, input) {
    const settings = getSettings();
    const prompt = buildPrompt(history, current, input, settings.childAge);

    if (settings.provider === 'puter') {
        if (!window.puter) throw new Error("Puter.js non chargé ou appareil hors-ligne");
        // Puter.js n'a pas de strict JSON mode, on parse la réponse brute
        const res = await window.puter.ai.chat(prompt, { model: 'claude-3-5-haiku' });
        const text = res.message.content;
        const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
        return JSON.parse(jsonStr);

    } else {
        // GitHub Models
        if (!settings.apiKey) throw new Error("Clé API manquante. Allez dans les paramètres.");
        const res = await fetch('https://models.inference.ai.azure.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` },
            body: JSON.stringify({
                model: settings.modelName || 'gpt-4o-mini',
                messages: [{role: "system", content: prompt}],
                response_format: { type: "json_object" }
            })
        });
        if (!res.ok) throw new Error("Erreur réseau de l'API GitHub");
        const data = await res.json();
        return JSON.parse(data.choices[0].message.content);
    }
}
