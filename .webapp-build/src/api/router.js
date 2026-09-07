import { getSecrets, getSettings } from '../storage/settings.js';
import { logDebug } from '../core/debug.js';

function parseContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Réponse IA vide.');
  return JSON.parse(content);
}

async function readError(response) {
  try {
    const payload = await response.json();
    return payload?.error?.message || JSON.stringify(payload).slice(0, 400);
  } catch { return `HTTP ${response.status}`; }
}

export async function queryStructured({ name, schema, instructions, userInput, maxOutputTokens = 7000 }) {
  const settings = getSettings();
  const apiKey = getSecrets().groqApiKey;
  if (!apiKey) throw new Error('Ajoute une clé Groq gratuite dans l’espace parents.');
  const body = {
    model: settings.generationModel || 'openai/gpt-oss-120b',
    messages: [
      { role: 'system', content: instructions },
      { role: 'user', content: userInput }
    ],
    reasoning_effort: 'medium',
    max_completion_tokens: maxOutputTokens,
    response_format: {
      type: 'json_schema',
      json_schema: { name, strict: true, schema }
    }
  };
  logDebug('ai.request', { name, model: body.model, inputLength: userInput.length });
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await readError(response);
    logDebug('ai.error', { status: response.status, detail });
    if (response.status === 429) throw new Error('La limite gratuite est atteinte pour le moment. Réessaie dans quelques instants.');
    throw new Error(`La génération a échoué : ${detail}`);
  }
  const payload = await response.json();
  const data = parseContent(payload);
  logDebug('ai.success', { name, model: body.model });
  return { data, usage: payload.usage || null };
}
