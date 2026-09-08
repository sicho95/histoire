import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeStory, validateStory } from '../src/core/story-model.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(await readFile(join(root, 'stories/catalog.json'), 'utf8'));
let failed = false;

function signatureMetrics(story) {
  const words = text => String(text || '').trim().split(/\s+/).filter(Boolean).length;
  const wpm = story.ageBand === '2-5' ? 95 : 120;
  const paths = [];
  function walk(nodeId, totalWords, wordsSinceChoice, choiceGaps, choicesSeen, trail = []) {
    if (trail.includes(nodeId)) throw new Error(`Boucle narrative détectée : ${[...trail, nodeId].join(' > ')}`);
    const node = story.nodes[nodeId];
    const narratedWords = words(node.text) + (node.choices.length ? words(node.question) : 0);
    const nextTotal = totalWords + narratedWords;
    const nextSegment = wordsSinceChoice + narratedWords;
    if (node.isEnding) {
      paths.push({ totalWords: nextTotal, choiceGaps, choices: choicesSeen });
      return;
    }
    if (node.nextNode) return walk(node.nextNode, nextTotal, nextSegment, choiceGaps, choicesSeen, [...trail, nodeId]);
    const gaps = [...choiceGaps, nextSegment / wpm * 60];
    for (const option of node.choices) walk(option.nextNode, nextTotal, 0, gaps, choicesSeen + 1, [...trail, nodeId]);
  }
  walk(story.startNode, words(`${story.title}. ${story.intro}`), 0, [], 0);
  const durations = paths.map(path => path.totalWords / wpm + path.choices * 4 / 60);
  const gaps = paths.flatMap(path => path.choiceGaps);
  return {
    paths: paths.length,
    choices: [Math.min(...paths.map(path => path.choices)), Math.max(...paths.map(path => path.choices))],
    duration: [Math.min(...durations), Math.max(...durations)],
    gaps: [Math.min(...gaps), Math.max(...gaps)]
  };
}

async function validateSignatureArt(raw) {
  const errors = [];
  const choices = raw.nodes.flatMap(node => node.choices || []);
  const illustrations = choices.map(choice => choice.illustration);
  const expectedPrefix = `./assets/stories/${raw.id}/choices/`;
  if (new Set(illustrations).size !== illustrations.length) errors.push('chaque choix signature doit avoir une illustration unique.');
  for (const choice of choices) {
    const expected = `${expectedPrefix}${choice.id}.jpg`;
    if (choice.illustration !== expected) {
      errors.push(`${choice.id}: illustration attendue ${expected}.`);
      continue;
    }
    try { await access(join(root, choice.illustration.replace(/^\.\//, ''))); }
    catch { errors.push(`${choice.id}: fichier d’illustration introuvable.`); }
  }
  return errors;
}

for (const entry of catalog.stories) {
  const raw = JSON.parse(await readFile(join(root, 'stories', entry.file), 'utf8'));
  const story = normalizeStory(raw, { source: 'github', revision: entry.revision });
  const result = validateStory(story, { editorial: true });
  if (entry.signature) result.errors.push(...await validateSignatureArt(raw));
  result.ok = result.errors.length === 0;
  if (!result.ok) {
    failed = true;
    console.error(`${entry.file}:\n- ${result.errors.join('\n- ')}`);
  } else {
    const metrics = signatureMetrics(story);
    const [minDuration, maxDuration] = metrics.duration;
    const [minGap, maxGap] = metrics.gaps;
    if (entry.signature) {
      const target = Number(entry.durationMinutes);
      const minAllowed = target >= 18 ? 18 : target >= 10 ? 8.5 : 7;
      const maxAllowed = target >= 18 ? 22.5 : target >= 10 ? 12 : 10;
      if (minDuration < minAllowed || maxDuration > maxAllowed) {
        failed = true;
        console.error(`${entry.file}: durée hors cible (${minDuration.toFixed(1)}–${maxDuration.toFixed(1)} min).`);
      }
      if (maxGap > 150) {
        failed = true;
        console.error(`${entry.file}: un embranchement arrive après ${Math.round(maxGap)} s (> 150 s).`);
      }
      if (target <= 10 && minGap < 45) {
        failed = true;
        console.error(`${entry.file}: deux embranchements sont séparés de seulement ${Math.round(minGap)} s (< 45 s).`);
      }
    }
    console.log(`${entry.file}: OK (${Object.keys(story.nodes).length} scènes, ${metrics.choices[0]} choix, ${minDuration.toFixed(1)}–${maxDuration.toFixed(1)} min, intervalles ${Math.round(minGap)}–${Math.round(maxGap)} s)`);
  }
  if (result.warnings.length) console.warn(`  avertissements: ${result.warnings.join(' | ')}`);
}

if (failed) process.exitCode = 1;
