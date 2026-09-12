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
    return {
      message: payload?.error?.message || JSON.stringify(payload).slice(0, 400),
      code: payload?.error?.code || '',
      failedGeneration: payload?.error?.failed_generation
    };
  } catch {
    return { message: `HTTP ${response.status}`, code: '', failedGeneration: null };
  }
}

function parseJsonString(value) {
  const source = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(source); } catch {
    const start = source.indexOf('{');
    const end = source.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try { return JSON.parse(source.slice(start, end + 1)); } catch { return null; }
  }
}

export function extractFailedGeneration(value, depth = 0) {
  if (!value || depth > 3) return null;
  if (typeof value === 'string') return parseJsonString(value);
  if (Array.isArray(value)) return null;
  if (typeof value !== 'object') return null;
  if (value.nodes && (value.title || value.storyBible || value.story_bible)) return value;
  if (Array.isArray(value.patches)) return value;
  for (const key of ['content', 'output', 'text', 'generated_json', 'attempted_arguments', 'arguments']) {
    const candidate = extractFailedGeneration(value[key], depth + 1);
    if (candidate) return candidate;
  }
  return null;
}

export function isSchemaFailure(detail) {
  return detail?.code === 'json_validate_failed'
    || /does not match the expected schema|jsonschema:/i.test(detail?.message || '');
}

export function parseRateLimitReset(value) {
  const source = String(value || '').trim().toLowerCase();
  if (!source) return 0;
  const minutes = Number(/([\d.]+)m(?!s)/.exec(source)?.[1] || 0);
  const seconds = Number(/([\d.]+)s/.exec(source)?.[1] || 0);
  const milliseconds = Number(/([\d.]+)ms/.exec(source)?.[1] || 0);
  return Math.max(0, Math.ceil(minutes * 60000 + seconds * 1000 + milliseconds));
}

function rateLimitInfo(response, requestStartedAt) {
  const get = name => response.headers?.get?.(name) || '';
  return {
    requestStartedAt,
    completedAt: Date.now(),
    remainingTokens: Number(get('x-ratelimit-remaining-tokens')) || null,
    resetMs: parseRateLimitReset(get('x-ratelimit-reset-tokens')),
    retryAfterMs: Math.ceil((Number(get('retry-after')) || 0) * 1000)
  };
}

function friendlyApiError(status, detail) {
  if (status === 401) return 'La clé Groq n’a pas été acceptée. Vérifie-la dans l’espace Parents.';
  if (status === 429 || /request too large|tokens per minute|\bTPM\b/i.test(detail?.message || '')) {
    return 'La limite gratuite de Groq est atteinte pour le moment. Tes choix sont conservés : attends environ une minute, puis réessaie.';
  }
  if (isSchemaFailure(detail)) return 'Groq n’a pas réussi à terminer correctement l’histoire. Tes choix sont conservés : réessaie dans un instant.';
  return `La génération a échoué : ${detail?.message || `HTTP ${status}`}`;
}

export async function queryStructured({
  name,
  schema,
  instructions,
  userInput,
  maxOutputTokens = 7000,
  repair,
  retryHint = '',
  onRetry,
  reasoningEffort = 'medium',
  maxAttempts = 2
}) {
  const settings = getSettings();
  const apiKey = getSecrets().groqApiKey;
  if (!apiKey) throw new Error('Ajoute une clé Groq gratuite dans l’espace parents.');
  const baseBody = {
    model: settings.generationModel || 'openai/gpt-oss-120b',
    reasoning_effort: reasoningEffort,
    max_completion_tokens: maxOutputTokens,
    response_format: {
      type: 'json_schema',
      json_schema: { name, strict: true, schema }
    }
  };

  const attempts = Math.max(1, Math.min(2, Number(maxAttempts) || 1));
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const requestStartedAt = Date.now();
    const messages = [
      { role: 'system', content: instructions },
      { role: 'user', content: userInput }
    ];
    if (attempt > 1) {
      messages.push({
        role: 'system',
        content: `Vérification finale obligatoire : rends de nouveau la réponse complète et n’omets aucune propriété requise du schéma JSON. ${retryHint}`.trim()
      });
    }
    const body = { ...baseBody, messages };
    logDebug('ai.request', { name, model: body.model, inputLength: userInput.length, attempt });
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const detail = await readError(response);
      logDebug('ai.error', { status: response.status, code: detail.code, message: detail.message, attempt });
      if (isSchemaFailure(detail)) {
        const candidate = extractFailedGeneration(detail.failedGeneration);
        if (candidate && repair) {
          try {
            const data = repair(candidate);
            logDebug('ai.recovered', { name, model: body.model, attempt });
            return { data, usage: null, recovered: true };
          } catch (error) {
            logDebug('ai.repair.error', { name, message: error.message, attempt });
          }
        }
        if (attempt < attempts) {
          onRetry?.(attempt + 1);
          continue;
        }
      }
      throw new Error(friendlyApiError(response.status, detail));
    }
    try {
      const payload = await response.json();
      const data = parseContent(payload);
      logDebug('ai.success', { name, model: body.model, attempt });
      return { data, usage: payload.usage || null, rateLimit: rateLimitInfo(response, requestStartedAt) };
    } catch (error) {
      logDebug('ai.parse.error', { name, message: error.message, attempt });
      if (attempt < attempts) {
        onRetry?.(attempt + 1);
        continue;
      }
      throw new Error('Groq a renvoyé une histoire illisible. Tes choix sont conservés : réessaie dans un instant.');
    }
  }
  throw new Error('La génération n’a pas pu aboutir. Réessaie dans un instant.');
}
