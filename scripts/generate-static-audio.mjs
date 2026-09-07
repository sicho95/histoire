import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const audioRoot = join(root, 'audio');
const catalog = JSON.parse(await readFile(join(root, 'stories/catalog.json'), 'utf8'));
const force = process.argv.includes('--force');
const concurrency = Math.max(1, Math.min(4, Number(process.env.HISTOIRE_AUDIO_JOBS || 3)));

function hashText(text) {
  let hash = 2166136261;
  for (const char of String(text || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function expressiveText(text, narration = {}) {
  const moodPause = ['mystery', 'suspense', 'gentle_fear'].includes(narration.mood) ? 380 : narration.mood === 'calm' ? 420 : 280;
  return String(text)
    .replace(/…+/g, `… [[slnc ${moodPause + 180}]] `)
    .replace(/([!?])\s+/g, `$1 [[slnc ${moodPause}]] `)
    .replace(/\.\s+/g, `. [[slnc ${moodPause - 60}]] `)
    .replace(/:\s+(?=[«“"])/g, `: [[slnc 220]] `);
}

function voiceFor(story) {
  return story.heroVoice === 'male' ? 'Thomas' : 'Flo';
}

function rateFor(story, narration = {}) {
  if (story.ageBand === '2-5') return narration.pace === 'normal' ? 118 : 110;
  if (narration.pace === 'lively') return 145;
  if (narration.pace === 'slow') return 125;
  return 135;
}

async function validFile(file) {
  try { return (await stat(file)).size > 4096; } catch { return false; }
}

function runSay({ file, voice, rate, text }) {
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/say', ['-v', voice, '-r', String(rate), '-o', file, '--data-format=aac', '--bit-rate=64000', text], { stdio: ['ignore', 'ignore', 'pipe'] });
    let error = '';
    child.stderr.on('data', chunk => { error += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(error.trim() || `say a quitté avec le code ${code}`)));
  });
}

const jobs = [];
for (const entry of catalog.stories) {
  const story = JSON.parse(await readFile(join(root, 'stories', entry.file), 'utf8'));
  const introNarration = { mood: 'wonder', pace: 'slow', intensity: 2 };
  jobs.push({ story, nodeId: 'intro', text: `${story.title}. ${story.intro}`, narration: introNarration });
  for (const node of story.nodes) {
    jobs.push({ story, nodeId: node.id, text: node.text, narration: node.narration });
    if (node.question) jobs.push({ story, nodeId: `${node.id}-question`, text: node.question, narration: { ...node.narration, pace: 'slow' } });
  }
}

let completed = 0;
const tracks = {};
let cursor = 0;
async function worker() {
  while (cursor < jobs.length) {
    const index = cursor++;
    const job = jobs[index];
    const directory = join(audioRoot, 'm4a', job.story.id);
    const relativeFile = `m4a/${job.story.id}/${job.nodeId}.m4a`;
    const file = join(audioRoot, relativeFile);
    await mkdir(directory, { recursive: true });
    if (force || !(await validFile(file))) {
      await runSay({
        file,
        voice: voiceFor(job.story),
        rate: rateFor(job.story, job.narration),
        text: expressiveText(job.text, job.narration)
      });
      if (!(await validFile(file))) throw new Error(`Piste vide : ${relativeFile}`);
    }
    tracks[`${job.story.id}:${job.nodeId}`] = {
      file: relativeFile,
      textHash: hashText(job.text),
      voice: voiceFor(job.story),
      model: 'macos-say',
      format: 'm4a',
      narration: job.narration
    };
    completed += 1;
    if (completed % 10 === 0 || completed === jobs.length) console.log(`${completed}/${jobs.length} pistes prêtes`);
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
const manifest = {
  schemaVersion: 2,
  styleVersion: 'signature-fr-v1',
  generatedAt: new Date().toISOString(),
  tracks: Object.fromEntries(Object.entries(tracks).sort(([a], [b]) => a.localeCompare(b, 'fr')))
};
await writeFile(join(audioRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Manifest écrit avec ${jobs.length} pistes.`);
