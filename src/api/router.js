import { logDebug } from '../core/debug.js';
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
  const payload = provider === 'github'
    ? { url: 'https://models.inference.ai.azure.com/chat/completions', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: { model: model || 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.8, response_format: { type: 'json_object' } } }
    : { url: 'https://api.groq.com/openai/v1/chat/completions', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: { model: model || 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.8, response_format: { type: 'json_object' } } };
  logDebug('llm.request', { provider, model, prompt });
  const res = await fetch(payload.url, { method: 'POST', headers: payload.headers, body: JSON.stringify(payload.body) });
  const text = await res.text();
  logDebug('llm.http', { provider, status: res.status, ok: res.ok, bodyPreview: text.slice(0, 4000) });
  if (!res.ok) return { rawText: text, data: null, provider, ok: false, status: res.status };
  let outer = null;
  try { outer = JSON.parse(text); } catch {}
  const rawText = outer?.choices?.[0]?.message?.content || text;
  const data = parseMaybeJson(rawText);
  logDebug('llm.parsed', { provider, rawText, parsed: data });
  return { rawText, data, provider, ok: !!data, status: res.status };
}
