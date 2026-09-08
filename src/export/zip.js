const encoder = new TextEncoder();
const decoder = new TextDecoder();

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function bytesOf(value) {
  if (value instanceof Uint8Array) return Promise.resolve(value);
  if (value instanceof ArrayBuffer) return Promise.resolve(new Uint8Array(value));
  if (value instanceof Blob) return value.arrayBuffer().then(buffer => new Uint8Array(buffer));
  return Promise.resolve(encoder.encode(String(value)));
}

function header(size) {
  const bytes = new Uint8Array(size);
  return { bytes, view: new DataView(bytes.buffer) };
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  };
}

function safeName(name) {
  const clean = String(name).replaceAll('\\', '/').replace(/^\/+/, '');
  if (!clean || clean.split('/').includes('..')) throw new Error('Nom de fichier ZIP invalide.');
  return clean;
}

export async function createZip(files) {
  const entries = [];
  let offset = 0;
  const localParts = [];
  const stamp = dosDateTime();

  for (const file of files) {
    const name = safeName(file.name);
    const nameBytes = encoder.encode(name);
    const data = await bytesOf(file.data);
    const crc = crc32(data);
    const local = header(30);
    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0x0800, true);
    local.view.setUint16(8, 0, true);
    local.view.setUint16(10, stamp.time, true);
    local.view.setUint16(12, stamp.date, true);
    local.view.setUint32(14, crc, true);
    local.view.setUint32(18, data.length, true);
    local.view.setUint32(22, data.length, true);
    local.view.setUint16(26, nameBytes.length, true);
    localParts.push(local.bytes, nameBytes, data);
    entries.push({ nameBytes, dataLength: data.length, crc, offset });
    offset += local.bytes.length + nameBytes.length + data.length;
  }

  const centralOffset = offset;
  const centralParts = [];
  for (const entry of entries) {
    const central = header(46);
    central.view.setUint32(0, 0x02014b50, true);
    central.view.setUint16(4, 20, true);
    central.view.setUint16(6, 20, true);
    central.view.setUint16(8, 0x0800, true);
    central.view.setUint16(10, 0, true);
    central.view.setUint16(12, stamp.time, true);
    central.view.setUint16(14, stamp.date, true);
    central.view.setUint32(16, entry.crc, true);
    central.view.setUint32(20, entry.dataLength, true);
    central.view.setUint32(24, entry.dataLength, true);
    central.view.setUint16(28, entry.nameBytes.length, true);
    central.view.setUint32(42, entry.offset, true);
    centralParts.push(central.bytes, entry.nameBytes);
    offset += central.bytes.length + entry.nameBytes.length;
  }

  const end = header(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(8, entries.length, true);
  end.view.setUint16(10, entries.length, true);
  end.view.setUint32(12, offset - centralOffset, true);
  end.view.setUint32(16, centralOffset, true);
  return new Blob([...localParts, ...centralParts, end.bytes], { type: 'application/zip' });
}

export async function readZip(input) {
  const buffer = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let endOffset = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { endOffset = offset; break; }
  }
  if (endOffset < 0) throw new Error('Ce fichier ZIP est invalide.');
  const count = view.getUint16(endOffset + 10, true);
  let cursor = view.getUint32(endOffset + 16, true);
  const files = new Map();
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('Répertoire ZIP invalide.');
    const method = view.getUint16(cursor + 10, true);
    if (method !== 0) throw new Error('Ce ZIP compressé n’est pas compatible avec cette version.');
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = safeName(decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength)));
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('Entrée ZIP invalide.');
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset + size > bytes.length) throw new Error('Entrée ZIP tronquée.');
    files.set(name, bytes.slice(dataOffset, dataOffset + size));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

export function decodeZipText(bytes) {
  return decoder.decode(bytes);
}
