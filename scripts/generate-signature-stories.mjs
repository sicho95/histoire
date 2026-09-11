import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import definitions from '../content/signature-stories.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const forceSeed = process.argv.includes('--force-seed');
function buildStory(definition, featuredOrder) {
  const nodes = [];
  definition.episodes.forEach((episode, index) => {
    const number = index + 1;
    const sceneId = `decision-${number}`;
    const nextSceneId = `decision-${number + 1}`;
    const options = episode.choices.map((option, optionIndex) => {
      const suffix = String.fromCharCode(97 + optionIndex);
      return {
        id: `${sceneId}-${suffix}`,
        label: option.label,
        emoji: option.emoji,
        illustration: `./assets/stories/${definition.id}/choices/${sceneId}-${suffix}.jpg`,
        nextNode: `${sceneId}-suite-${suffix}`,
        consequenceHint: option.consequence.slice(0, 120)
      };
    });
    nodes.push({
      id: sceneId,
      headline: episode.headline,
      coverEmoji: episode.emoji,
      text: episode.scene,
      question: episode.question,
      isEnding: false,
      narration: { mood: episode.mood, pace: episode.pace, intensity: episode.mood === 'suspense' ? 3 : 2 },
      choices: options
    });
    episode.choices.forEach((option, optionIndex) => {
      const suffix = String.fromCharCode(97 + optionIndex);
      const transition = episode.final ? '' : definition.transitions[index];
      const reflection = episode.final ? '' : definition.reflections?.[index];
      nodes.push({
        id: `${sceneId}-suite-${suffix}`,
        headline: option.label,
        coverEmoji: option.emoji,
        text: `${option.consequence} ${transition} ${reflection || ''}`.trim(),
        question: '',
        isEnding: false,
        nextNode: episode.final ? `fin-${suffix}` : nextSceneId,
        narration: { mood: index === definition.episodes.length - 1 ? 'triumph' : episode.mood, pace: episode.pace, intensity: 2 },
        choices: []
      });
    });
  });
  definition.endings.forEach((ending, index) => nodes.push({
    id: `fin-${String.fromCharCode(97 + index)}`,
    headline: ending.title,
    coverEmoji: ending.emoji,
    text: ending.text,
    question: '',
    isEnding: true,
    narration: { mood: 'triumph', pace: definition.ageBand === '2-5' ? 'slow' : 'normal', intensity: 2 },
    choices: []
  }));
  return {
    schemaVersion: 2,
    id: definition.id,
    title: definition.title,
    coverEmoji: definition.coverEmoji,
    coverImage: definition.coverImage,
    intro: definition.intro,
    ageRange: definition.ageRange,
    ageBand: definition.ageBand,
    heroVoice: definition.heroVoice,
    featuredOrder,
    durationMinutes: definition.durationMinutes,
    startNode: 'decision-1',
    storyBible: definition.bible,
    nodes,
    revision: 6,
    status: 'published',
    createdAt: '2026-09-07T00:00:00.000Z',
    updatedAt: '2026-09-08T00:00:00.000Z'
  };
}

await mkdir(join(root, 'stories'), { recursive: true });
const stories = definitions.map(buildStory);
if (!forceSeed) {
  for (let index = 0; index < stories.length; index += 1) {
    try {
      const existing = JSON.parse(await readFile(join(root, 'stories', `${stories[index].id}.json`), 'utf8'));
      stories[index] = existing;
    } catch {}
  }
}
for (const story of stories) {
  await writeFile(join(root, 'stories', `${story.id}.json`), `${JSON.stringify(story, null, 2)}\n`);
}
const catalog = {
  schemaVersion: 1,
  revision: 7,
  stories: stories.map(story => ({
    id: story.id,
    title: story.title,
    file: `${story.id}.json`,
    revision: story.revision,
    ageRange: story.ageRange,
    ageBand: story.ageBand,
    durationMinutes: story.durationMinutes,
    coverImage: story.coverImage,
    audioReady: true,
    signature: true,
    choiceAssets: story.nodes.flatMap(node => node.choices.map(choice => choice.illustration))
  }))
};
await writeFile(join(root, 'stories/catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Generated ${stories.length} signature stories.`);
