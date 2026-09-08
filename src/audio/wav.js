function writeAscii(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

export function pcm16ToWav(pcm, { sampleRate = 24000, channels = 1 } = {}) {
  const bytes = pcm instanceof Uint8Array ? pcm : new Uint8Array(pcm);
  const output = new Uint8Array(44 + bytes.byteLength);
  const view = new DataView(output.buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + bytes.byteLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, bytes.byteLength, true);
  output.set(bytes, 44);
  return output;
}
