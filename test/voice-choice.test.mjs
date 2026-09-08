import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpokenChoicePrompt } from '../src/audio/choice-prompt.js';
import { forceFrenchPronunciation } from '../src/audio/french-speech.js';

test('force les onomatopées vers une graphie vocale française sans changer le récit', () => {
  assert.equal(
    forceFrenchPronunciation('Plouf ! Ding-ding, puis boum et vroum.'),
    'plouffe ! dingue-dingue, puis boume et vroume.'
  );
});

test('prononce Tin à la française, y compris répété et en capitales', () => {
  assert.equal(forceFrenchPronunciation('Tin… Tin TIN !'), 'tain… tain tain !');
});

test('lit la question puis chaque choix affiché', () => {
  assert.equal(
    buildSpokenChoicePrompt('Où aller ?', [{ label: 'Vers la forêt' }, { label: 'Dans le bateau' }, { label: 'Sous les étoiles' }]),
    'À toi de choisir… Où aller ? Premier choix : Vers la forêt. Deuxième choix : Dans le bateau. Troisième choix : Sous les étoiles. Prends ton temps, regarde bien les images, puis touche ton choix.'
  );
});

test('coupe le micro sans envoyer de texte si personne ne parle', async t => {
  const originalWindow = globalThis.window;
  let aborted = false;
  class SilentRecognition {
    start() { queueMicrotask(() => this.onstart?.()); }
    abort() { aborted = true; queueMicrotask(() => this.onerror?.({ error: 'aborted' })); }
    stop() { queueMicrotask(() => this.onend?.()); }
  }
  globalThis.window = { SpeechRecognition: SilentRecognition };
  const { listenOnce, stopListening } = await import(`../src/audio/stt.js?silent=${Date.now()}`);
  t.after(() => { stopListening(); globalThis.window = originalWindow; });
  assert.equal(await listenOnce({ noSpeechMs: 5, silenceMs: 5, maxMs: 50 }), null);
  assert.equal(aborted, true);
});

test('arrête le micro après la phrase et renvoie sa transcription', async t => {
  const originalWindow = globalThis.window;
  let stopped = false;
  class SpeakingRecognition {
    start() {
      queueMicrotask(() => {
        this.onstart?.();
        this.onspeechstart?.();
        const result = [{ transcript: 'un passage secret' }];
        result.isFinal = true;
        this.onresult?.({ results: [result] });
        this.onspeechend?.();
      });
    }
    abort() { queueMicrotask(() => this.onerror?.({ error: 'aborted' })); }
    stop() { stopped = true; queueMicrotask(() => this.onend?.()); }
  }
  globalThis.window = { SpeechRecognition: SpeakingRecognition };
  const { listenOnce, stopListening } = await import(`../src/audio/stt.js?speaking=${Date.now()}`);
  t.after(() => { stopListening(); globalThis.window = originalWindow; });
  assert.equal(await listenOnce({ noSpeechMs: 20, silenceMs: 5, maxMs: 100 }), 'un passage secret');
  assert.equal(stopped, true);
});
