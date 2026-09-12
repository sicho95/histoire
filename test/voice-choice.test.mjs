import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpokenChoicePrompt } from '../src/audio/choice-prompt.js';
import { forceFrenchPronunciation } from '../src/audio/french-speech.js';
import { prepareMicrophoneAudioSession, restorePlaybackAudioSession } from '../src/audio/audio-session.js';

test('force les onomatopées vers une graphie vocale française sans changer le récit', () => {
  assert.equal(
    forceFrenchPronunciation('Plouf ! Ding-ding, puis boum et vroum.'),
    'plouffe ! dingue-dingue, puis boume et vroume.'
  );
});

test('prononce Tin à la française, y compris répété et en capitales', () => {
  assert.equal(forceFrenchPronunciation('Tin… Tin TIN !'), 'tain… tain tain !');
});

test('force les interjections et le prénom Nino à rester en français', () => {
  assert.equal(forceFrenchPronunciation('Oh ! Nino souffle doucement.'), 'Ô ! Ninô souffle doucement.');
});

test('retire le balisage et lie les inversions françaises pour la voix seulement', () => {
  assert.equal(
    forceFrenchPronunciation('**Vite !** dit-il. Où va-t-elle ? *Écoute.*'),
    'Vite ! ditil. Où vatelle ? Écoute.'
  );
});

test('lit la question puis chaque choix affiché', () => {
  assert.equal(
    buildSpokenChoicePrompt('Où aller ?', [{ label: 'Vers la forêt' }, { label: 'Dans le bateau' }, { label: 'Sous les étoiles' }]),
    'À toi de choisir… Où aller ? Choix numéro 1 : Vers la forêt. Choix numéro 2 : Dans le bateau. Choix numéro 3 : Sous les étoiles. Prends ton temps, puis touche l’image 1, 2, 3.'
  );
});

test('annonce les couleurs pour les choix générés des 2-5 ans', () => {
  assert.equal(
    buildSpokenChoicePrompt('Que faire ?', [{ label: 'Suivre la bulle', learned: true }, { label: 'Ouvrir la porte', learned: true }], { ageBand: '2-5' }),
    'À toi de choisir… Que faire ? Choix bleu : Suivre la bulle. Choix vert : Ouvrir la porte. Prends ton temps, puis touche la couleur de ton choix.'
  );
});

test('rétablit la sortie de lecture après le micro quand Audio Session existe', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const audioSession = { type: 'auto' };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { audioSession } });
  t.after(() => descriptor
    ? Object.defineProperty(globalThis, 'navigator', descriptor)
    : delete globalThis.navigator);
  prepareMicrophoneAudioSession();
  assert.equal(audioSession.type, 'play-and-record');
  await restorePlaybackAudioSession({ settleMs: 0 });
  assert.equal(audioSession.type, 'playback');
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
