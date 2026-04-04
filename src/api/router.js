import { logDebug } from '../core/debug.js';
import { getSettings } from '../storage/settings.js';

function parseMaybeJson(rawText) {
  if (!rawText) return null;
  const trimmed = rawText.trim();
  const candidates = [trimmed];
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) candidates.push(fence[1].trim());
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  for (const candidate of candidates) {
    try { return JSON.parse(candidate); } catch {}
  }
  return null;
}

export async function queryLlm({ provider, apiKey, model, prompt }) {
  if (!apiKey) {
    logDebug('llm.skip', { reason: 'missing_api_key', provider, model });
    return { rawText: '', data: null, provider, ok: false };
  }
  const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
  const ghUrl   = 'https://models.inference.ai.azure.com/chat/completions';
  const isGH = provider === 'github';
  const url = isGH ? ghUrl : groqUrl;
  const body = {
    model: model || (isGH ? 'gpt-4o-mini' : 'llama-3.3-70b-versatile'),
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    response_format: { type: 'json_object' },
  };
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
  logDebug('llm.request', { provider, model, prompt: prompt.slice(0, 200) });
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  logDebug('llm.http', { provider, status: res.status, ok: res.ok, bodyPreview: text.slice(0, 4000) });
  if (!res.ok) return { rawText: text, data: null, provider, ok: false, status: res.status };
  let outer = null;
  try { outer = JSON.parse(text); } catch {}
  const rawText = outer?.choices?.[0]?.message?.content || text;
  const data = parseMaybeJson(rawText);
  logDebug('llm.parsed', { provider, parsed: !!data });
  return { rawText, data, provider, ok: !!data, status: res.status };
}

/**
 * callLLM(prompt) — alias simplifié (wizard.js, weaver.js)
 * Lit la clé et le modèle depuis les settings courants.
 */
export async function callLLM(prompt) {
  const s = getSettings();
  return queryLlm({
    provider: 'groq',
    apiKey: s.apiKey,
    model: s.model || 'llama-3.3-70b-versatile',
    prompt,
  });
}
