import test from 'node:test';
import assert from 'node:assert/strict';

test('réutilise le même lecteur pour les scènes qui s’enchaînent', async t => {
  const originalAudio = globalThis.Audio;
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;
  const originalSessionStorage = globalThis.sessionStorage;
  let audioCreations = 0;

  const memoryStorage = () => {
    const values = new Map();
    return {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key)
    };
  };

  class FakeAudio {
    constructor() {
      audioCreations += 1;
      this.onended = null;
      this.onerror = null;
      this.src = '';
    }

    pause() {}

    play() {
      queueMicrotask(() => this.onended?.());
      return Promise.resolve();
    }
  }

  globalThis.Audio = FakeAudio;
  globalThis.window = { speechSynthesis: { cancel() {} } };
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();

  const tts = await import(`../src/audio/tts.js?player-reuse=${Date.now()}`);
  const manifest = {
    tracks: {
      'histoire:scene-1': { file: 'scene-1.mp3', textHash: tts.hashText('Première scène.') },
      'histoire:scene-2': { file: 'scene-2.mp3', textHash: tts.hashText('Deuxième scène.') }
    }
  };

  globalThis.fetch = async url => String(url).includes('manifest.json')
    ? { ok: true, json: async () => manifest }
    : { ok: true, blob: async () => new Blob(['audio'], { type: 'audio/mpeg' }) };

  t.after(() => {
    tts.stopSpeak();
    globalThis.Audio = originalAudio;
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
    globalThis.sessionStorage = originalSessionStorage;
  });

  await tts.speak('Première scène.', { storyId: 'histoire', nodeId: 'scene-1' });
  await tts.speak('Deuxième scène.', { storyId: 'histoire', nodeId: 'scene-2' });

  assert.equal(audioCreations, 1);
});
