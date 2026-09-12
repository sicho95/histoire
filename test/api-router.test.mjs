import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFailedGeneration, isSchemaFailure, parseRateLimitReset, queryStructured } from '../src/api/router.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function installBrowserState() {
  const previous = {
    localStorage: globalThis.localStorage,
    sessionStorage: globalThis.sessionStorage,
    fetch: globalThis.fetch
  };
  globalThis.localStorage = new MemoryStorage();
  globalThis.sessionStorage = new MemoryStorage();
  globalThis.sessionStorage.setItem('histoires_secrets_session_v2', JSON.stringify({ groqApiKey: 'gsk_test' }));
  return () => {
    globalThis.localStorage = previous.localStorage;
    globalThis.sessionStorage = previous.sessionStorage;
    globalThis.fetch = previous.fetch;
  };
}

const schemaFailure = {
  error: {
    message: "Generated JSON does not match the expected schema. Error: jsonschema: '/storyBible' missing properties: 'heroGoal'",
    code: 'json_validate_failed'
  }
};

test('reconnaît et extrait un JSON généré rejeté par Groq', () => {
  assert.equal(isSchemaFailure(schemaFailure.error), true);
  const story = { title: 'Lila', storyBible: { premise: 'Une aventure' }, nodes: [] };
  assert.deepEqual(extractFailedGeneration({ output: `\`\`\`json\n${JSON.stringify(story)}\n\`\`\`` }), story);
  const review = { assessment: 'à reprendre', patches: [{ nodeId: 'start', text: 'nouveau' }] };
  assert.deepEqual(extractFailedGeneration({ generated_json: review }), review);
});

test('comprend le délai de remise à zéro annoncé par Groq', () => {
  assert.equal(parseRateLimitReset('7.66s'), 7660);
  assert.equal(parseRateLimitReset('1m2.5s'), 62500);
  assert.equal(parseRateLimitReset('500ms'), 500);
});

test('relance une fois une génération refusée pour une propriété manquante', async () => {
  const restore = installBrowserState();
  const bodies = [];
  globalThis.fetch = async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    if (bodies.length === 1) return { ok: false, status: 400, json: async () => schemaFailure };
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{"title":"Lila"}' } }], usage: { total_tokens: 42 } })
    };
  };
  try {
    const result = await queryStructured({
      name: 'complete_child_story',
      schema: { type: 'object' },
      instructions: 'Écris une histoire.',
      userInput: 'Lila part à l’aventure.',
      retryHint: 'N’oublie pas heroGoal.'
    });
    assert.equal(result.data.title, 'Lila');
    assert.equal(bodies.length, 2);
    assert.equal(bodies[1].messages.length, 3);
    assert.match(bodies[1].messages[2].content, /heroGoal/);
  } finally {
    restore();
  }
});

test('ne relance pas une grande histoire et masque le détail technique du quota', async () => {
  const restore = installBrowserState();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return {
      ok: false,
      status: 413,
      json: async () => ({ error: { message: 'Request too large for organization secret-id on tokens per minute (TPM): Limit 8000, Requested 9821' } })
    };
  };
  try {
    await assert.rejects(queryStructured({
      name: 'complete_child_story', schema: { type: 'object' }, instructions: 'Histoire.', userInput: 'Lila.',
      maxAttempts: 1, reasoningEffort: 'low'
    }), error => {
      assert.match(error.message, /limite gratuite de Groq/i);
      assert.doesNotMatch(error.message, /secret-id|9821/);
      return true;
    });
    assert.equal(calls, 1);
  } finally {
    restore();
  }
});
