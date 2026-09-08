import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(await readFile(join(root, 'stories/catalog.json'), 'utf8'));
const manifest = JSON.parse(await readFile(join(root, 'audio/manifest.json'), 'utf8'));
const direction = JSON.parse(await readFile(join(root, 'config/voice-direction.json'), 'utf8'));

function hashText(text) {
  let hash = 2166136261;
  for (const char of String(text || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

const expected = new Map();
const storiesById = new Map();
for (const entry of catalog.stories) {
  if (!entry.audioReady) continue;
  const story = JSON.parse(await readFile(join(root, 'stories', entry.file), 'utf8'));
  storiesById.set(story.id, story);
  expected.set(`${story.id}:intro`, `${story.title}. ${story.intro}`);
  for (const node of story.nodes) {
    expected.set(`${story.id}:${node.id}`, node.text);
    if (node.question) expected.set(`${story.id}:${node.id}-question`, node.question);
  }
}

const errors = [];
for (const [key, text] of expected) {
  const track = manifest.tracks?.[key];
  if (!track) { errors.push(`Piste absente : ${key}`); continue; }
  if (track.textHash !== hashText(text)) errors.push(`Texte modifié sans régénérer la voix : ${key}`);
  const storyId = key.split(':')[0];
  const story = storiesById.get(storyId);
  const expectedVoice = direction.storyVoices?.[storyId] || direction.voices[story?.heroVoice];
  if (expectedVoice && track.voice !== expectedVoice) errors.push(`Narrateur incohérent pour ${key} : ${track.voice} au lieu de ${expectedVoice}`);
  if (track.model !== direction.engine) errors.push(`Ancien moteur vocal pour ${key} : ${track.model}`);
  if (track.format !== direction.format) errors.push(`Ancien format vocal pour ${key} : ${track.format}`);
  try {
    const info = await stat(join(root, 'audio', track.file));
    if (info.size <= 4096) errors.push(`Piste vide : ${track.file}`);
  } catch { errors.push(`Fichier absent : ${track.file}`); }
}

const stale = Object.keys(manifest.tracks || {}).filter(key => !expected.has(key));
if (stale.length) errors.push(`${stale.length} piste(s) obsolète(s) dans le manifeste.`);
if (manifest.styleVersion !== direction.styleVersion) errors.push(`Version de direction vocale incorrecte : ${manifest.styleVersion}.`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`${expected.size} pistes audio vérifiées (texte, manifeste et fichiers).`);
}
