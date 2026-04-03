export async function queryLlm({ provider, apiKey, model, prompt }) {
  if (!apiKey) return null;
  if (provider === 'groq') {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: model || 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.7, response_format: { type: 'json_object' } })
    });
    if (!res.ok) throw new Error(`Erreur API ${res.status}`);
    const data = await res.json();
    return JSON.parse(data.choices?.[0]?.message?.content || '{}');
  }
  return null;
}
