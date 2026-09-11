import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSpokenChoicePrompt } from '../src/audio/choice-prompt.js';
import { forceFrenchPronunciation } from '../src/audio/french-speech.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const audioRoot = join(root, 'audio');
const catalog = JSON.parse(await readFile(join(root, 'stories/catalog.json'), 'utf8'));
const direction = JSON.parse(await readFile(join(root, 'config/voice-direction.json'), 'utf8'));
const force = process.argv.includes('--force');
const concurrency = Math.max(1, Math.min(4, Number(process.env.HISTOIRE_AUDIO_JOBS || 3)));
const edgeTtsBin = process.env.EDGE_TTS_BIN || 'edge-tts';
let previousManifest = { tracks: {} };
try { previousManifest = JSON.parse(await readFile(join(audioRoot, 'manifest.json'), 'utf8')); } catch {}

function hashText(text) {
  let hash = 2166136261;
  for (const char of String(text || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function voiceFor(story) {
  return direction.storyVoices?.[story.id] || direction.voices[story.heroVoice] || direction.voices.female;
}

function signed(value, suffix) {
  const rounded = Math.round(value || 0);
  return `${rounded >= 0 ? '+' : ''}${rounded}${suffix}`;
}

function tuningFor(job) {
  const age = direction.ageProfiles[job.story.ageBand] || direction.ageProfiles['5-9'];
  const pace = direction.paceModifiers[job.narration?.pace] || direction.paceModifiers.normal;
  const mood = direction.moodProfiles[job.narration?.mood] || direction.moodProfiles.wonder;
  const intensity = direction.intensityProfiles?.[String(job.narration?.intensity || 2)] || {};
  const question = job.kind === 'question' ? direction.questionModifier : {};
  return {
    rate: signed(age.rate + pace.rate + mood.rate + (intensity.rate || 0) + (question.rate || 0), '%'),
    pitch: signed(age.pitch + (pace.pitch || 0) + mood.pitch + (intensity.pitch || 0) + (question.pitch || 0), 'Hz'),
    volume: signed(age.volume + (pace.volume || 0) + mood.volume + (intensity.volume || 0) + (question.volume || 0), '%')
  };
}

function spokenText(job) { return forceFrenchPronunciation(job.text); }

async function validFile(file) {
  try { return (await stat(file)).size > 4096; } catch { return false; }
}

function runEdgeTts({ file, voice, tuning, text }) {
  return new Promise((resolve, reject) => {
    const child = spawn(edgeTtsBin, ['--voice', voice, `--rate=${tuning.rate}`, `--pitch=${tuning.pitch}`, `--volume=${tuning.volume}`, '--text', text, '--write-media', file], { stdio: ['ignore', 'ignore', 'pipe'] });
    let error = '';
    child.stderr.on('data', chunk => { error += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(error.trim() || `edge-tts a quitté avec le code ${code}`)));
  });
}

async function generateWithRetry(job, file) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      await runEdgeTts({ file, voice: voiceFor(job.story), tuning: tuningFor(job), text: spokenText(job) });
      return;
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1200));
    }
  }
  throw lastError;
}

const jobs = [];
for (const entry of catalog.stories) {
  const story = JSON.parse(await readFile(join(root, 'stories', entry.file), 'utf8'));
  const introNarration = { mood: 'wonder', pace: 'slow', intensity: 2 };
  jobs.push({ story, nodeId: 'intro', text: `${story.title}. ${story.intro}`, narration: introNarration, kind: 'intro' });
  for (const node of story.nodes) {
    jobs.push({ story, nodeId: node.id, text: node.text, narration: node.narration, kind: 'scene' });
    if (node.question) jobs.push({ story, nodeId: `${node.id}-question`, text: buildSpokenChoicePrompt(node.question, node.choices, { ageBand: story.ageBand }), narration: { ...node.narration, pace: 'slow' }, kind: 'question' });
  }
}

let completed = 0;
const tracks = {};
let cursor = 0;
async function worker() {
  while (cursor < jobs.length) {
    const index = cursor++;
    const job = jobs[index];
    const directory = join(audioRoot, 'mp3', job.story.id);
    const relativeFile = `mp3/${job.story.id}/${job.nodeId}.mp3`;
    const file = join(audioRoot, relativeFile);
    await mkdir(directory, { recursive: true });
    const previous = previousManifest.tracks?.[`${job.story.id}:${job.nodeId}`];
    const speechHash = hashText(spokenText(job));
    if (force || previous?.textHash !== hashText(job.text) || previous?.speechHash !== speechHash || !(await validFile(file))) {
      await generateWithRetry(job, file);
      if (!(await validFile(file))) throw new Error(`Piste vide : ${relativeFile}`);
    }
    tracks[`${job.story.id}:${job.nodeId}`] = {
      file: relativeFile,
      textHash: hashText(job.text),
      speechHash,
      voice: voiceFor(job.story),
      model: direction.engine,
      format: direction.format,
      kind: job.kind,
      ageBand: job.story.ageBand,
      tuning: tuningFor(job),
      narration: job.narration
    };
    completed += 1;
    if (completed % 10 === 0 || completed === jobs.length) console.log(`${completed}/${jobs.length} pistes prêtes`);
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
const manifest = {
  schemaVersion: 2,
  styleVersion: direction.styleVersion,
  generatedAt: new Date().toISOString(),
  tracks: Object.fromEntries(Object.entries(tracks).sort(([a], [b]) => a.localeCompare(b, 'fr')))
};
await writeFile(join(audioRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Manifest écrit avec ${jobs.length} pistes.`);
