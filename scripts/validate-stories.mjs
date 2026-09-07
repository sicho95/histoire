import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeStory, validateStory } from '../src/core/story-model.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(await readFile(join(root, 'stories/catalog.json'), 'utf8'));
let failed = false;

for (const entry of catalog.stories) {
  const raw = JSON.parse(await readFile(join(root, 'stories', entry.file), 'utf8'));
  const story = normalizeStory(raw, { source: 'github', revision: entry.revision });
  const result = validateStory(story, { editorial: true });
  if (!result.ok) {
    failed = true;
    console.error(`${entry.file}:\n- ${result.errors.join('\n- ')}`);
  } else {
    console.log(`${entry.file}: OK (${Object.keys(story.nodes).length} scènes)`);
  }
  if (result.warnings.length) console.warn(`  avertissements: ${result.warnings.join(' | ')}`);
}

if (failed) process.exitCode = 1;
