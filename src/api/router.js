import { getSettings } from '../storage/settings.js';
import { buildPrompt } from './prompts.js';

export async function generateNextNode(history, current, input) {
    const s = getSettings();
    const prompt = buildPrompt(history, current, input, s.childAge);
    
    if (s.provider === 'puter') {
        if (!window.puter) throw new Error("Puter.js non chargé");
        const res = await window.puter.ai.chat(prompt, { model: 'claude-3-5-haiku' });
        const text = res.message.content;
        return JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
    } else {
        if (!s.apiKey) throw new Error("Clé API manquante.");
        
        // C'est ici la magie : on utilise un Proxy CORS gratuit pour contourner le blocage du navigateur
        const targetUrl = encodeURIComponent('https://models.inference.ai.azure.com/chat/completions');
        const proxyUrl = `https://corsproxy.io/?url=${targetUrl}`;

        const res = await fetch(proxyUrl, {
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${s.apiKey}` 
            },
            body: JSON.stringify({ 
                model: s.modelName || 'gpt-4o-mini', 
                messages: [{role: "system", content: prompt}], 
                response_format: { type: "json_object" } 
            })
        });
        
        if (!res.ok) throw new Error(`Erreur réseau (Proxy/API): ${res.status}`);
        const data = await res.json(); 
        return JSON.parse(data.choices[0].message.content);
    }
}
