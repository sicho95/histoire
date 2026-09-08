import { prepareSpeech, portableAudioId } from '../audio/tts.js';
import { buildReviewPackage, storyToPortable } from '../core/story-model.js';
import { putAudioCacheEntry } from '../storage/audio_cache.js';
import { saveDraft } from '../storage/database.js';
import { createZip, decodeZipText, readZip } from './zip.js';

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function narrationJobs(story) {
  const common = { storyId: story.id, heroVoice: story.heroVoice, ageBand: story.ageBand };
  const jobs = [{
    ...common,
    nodeId: 'intro',
    kind: 'intro',
    text: `${story.title}. ${story.intro}`,
    narration: { mood: 'wonder', pace: 'slow', intensity: 2 }
  }];
  for (const node of Object.values(story.nodes)) {
    jobs.push({ ...common, nodeId: node.id, kind: 'scene', text: node.text, narration: node.narration });
    if (node.question) jobs.push({ ...common, nodeId: `${node.id}-question`, kind: 'question', text: node.question, narration: { ...node.narration, pace: 'slow' } });
  }
  return jobs.filter(job => job.text);
}

function filenameFor(job) {
  return `audio/mp3/${job.storyId}/${job.nodeId}.mp3`;
}

function dataUrlFromBytes(bytes, type = 'audio/mpeg') {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return `data:${type};base64,${btoa(binary)}`;
}

export async function createStoryPackage(story, { onProgress = () => {} } = {}) {
  const portable = storyToPortable(story);
  const jobs = narrationJobs(story);
  const tracks = {};
  const audioFiles = [];
  for (let index = 0; index < jobs.length; index += 1) {
    const job = jobs[index];
    onProgress({ current: index + 1, total: jobs.length, label: job.kind === 'question' ? 'question' : 'passage' });
    const prepared = await prepareSpeech(job.text, job);
    if (!prepared?.blob) {
      throw new Error('Impossible de fabriquer tous les MP3. Réessaie en ligne avec Microsoft Edge, ou renseigne une clé Azure Speech gratuite.');
    }
    const file = filenameFor(job);
    audioFiles.push({ name: file, data: prepared.blob });
    tracks[`${story.id}:${job.nodeId}`] = {
      file: file.replace(/^audio\//, ''),
      textHash: prepared.textHash,
      voice: prepared.voice || story.heroVoice,
      provider: prepared.source,
      kind: job.kind,
      narration: job.narration
    };
  }
  const manifest = { schemaVersion: 2, packageVersion: 1, storyId: story.id, generatedAt: new Date().toISOString(), tracks };
  const review = buildReviewPackage(story, {
    creationContext: story.creationContext || null,
    playedPath: story.playedPath || []
  });
  const readme = `# ${story.title}\n\nArchive autonome Histoires à choisir.\n\n- story.json : histoire réimportable\n- review.json : dossier de relecture et de consolidation\n- audio/manifest.json : index des voix\n- audio/mp3/ : toutes les narrations et questions\n\nAvant une publication GitHub, un parent doit relire le texte et retirer toute information personnelle.\n`;
  return createZip([
    { name: 'story.json', data: json(portable) },
    { name: 'review.json', data: json(review) },
    { name: 'audio/manifest.json', data: json(manifest) },
    { name: 'README.md', data: readme },
    ...audioFiles
  ]);
}

export async function importStoryPackage(file) {
  const files = await readZip(file);
  const storyBytes = files.get('story.json');
  const manifestBytes = files.get('audio/manifest.json');
  if (!storyBytes || !manifestBytes) throw new Error('Ce ZIP ne contient pas une histoire complète.');
  const story = JSON.parse(decodeZipText(storyBytes));
  const manifest = JSON.parse(decodeZipText(manifestBytes));
  const draft = await saveDraft(story, story.creationContext || null);
  let audioCount = 0;
  for (const [trackKey, track] of Object.entries(manifest.tracks || {})) {
    const bytes = files.get(`audio/${track.file}`);
    const [, nodeId] = trackKey.split(':');
    if (!bytes || !nodeId || !track.textHash) continue;
    await putAudioCacheEntry({
      id: portableAudioId({ storyId: draft.id, nodeId, textHash: track.textHash }),
      dataUrl: dataUrlFromBytes(bytes),
      createdAt: Date.now(),
      textHash: track.textHash,
      storyId: draft.id,
      nodeId,
      voice: track.voice,
      provider: 'imported-package',
      narration: track.narration
    });
    audioCount += 1;
  }
  return { story: draft, audioCount };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
