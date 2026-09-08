import test from 'node:test';
import assert from 'node:assert/strict';
import { pcm16ToWav } from '../src/audio/wav.js';

test('encapsule le PCM Google TTS dans un WAV lisible', () => {
  const pcm = new Uint8Array([0, 0, 1, 0, 255, 255]);
  const wav = pcm16ToWav(pcm);
  assert.equal(new TextDecoder().decode(wav.subarray(0, 4)), 'RIFF');
  assert.equal(new TextDecoder().decode(wav.subarray(8, 12)), 'WAVE');
  assert.equal(new DataView(wav.buffer).getUint32(24, true), 24000);
  assert.equal(new DataView(wav.buffer).getUint32(40, true), pcm.length);
  assert.deepEqual(wav.subarray(44), pcm);
});
