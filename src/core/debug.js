const entries = [];
const MAX_ENTRIES = 800;

function serialize(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

export function logDebug(type, payload = {}) {
  const entry = { ts: new Date().toISOString(), type, payload };
  entries.push(entry);
  while (entries.length > MAX_ENTRIES) entries.shift();
  try { console.debug('[DEBUG]', type, payload); } catch {}
}

export function getDebugEntries() {
  return [...entries];
}

export function clearDebugEntries() {
  entries.length = 0;
}

export function downloadDebugTxt() {
  const text = entries.length
    ? entries.map(entry => `[${entry.ts}] ${entry.type}\n${serialize(entry.payload)}\n`).join('\n')
    : `Aucune entrée de debug. Active le mode debug puis relance un scénario de test.\n`;

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `debug-conteur-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
  a.click();
}
