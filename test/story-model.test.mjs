import test from 'node:test';
import assert from 'node:assert/strict';
import { assessGeneratedStory, buildReviewPackage, harmonizeCreatedStoryOpening, normalizeNarrationMood, normalizeStory, reachableNodeIds, storyPathMetrics, storyToPortable, validateStory } from '../src/core/story-model.js';
import { matchSpokenChoice, pickDisplayChoices } from '../src/core/choices.js';
import { createZip, decodeZipText, readZip } from '../src/export/zip.js';
import { currentPassageImage, displayChoiceImage, generatedChoiceColor } from '../src/core/illustrations.js';
import { buildFullStoryRequest, buildStoryRefinementRequest } from '../src/api/prompts.js';

const legacy = {
  id: 'Test ancien', title: 'Une histoire test', start_node: 'start',
  nodes: {
    start: { text: 'mot '.repeat(90), choices: [
      { label: 'Gauche', next_node: 'end-a' }, { label: 'Droite', next_node: 'end-b' }
    ] },
    'end-a': { text: 'fin '.repeat(50), is_ending: true, choices: [] },
    'end-b': { text: 'joie '.repeat(50), is_ending: true, choices: [] }
  }
};

test('normalise les anciens noms snake_case', () => {
  const story = normalizeStory(legacy);
  assert.equal(story.id, 'test-ancien');
  assert.equal(story.startNode, 'start');
  assert.equal(story.nodes.start.choices[0].nextNode, 'end-a');
  assert.equal(story.nodes['end-a'].isEnding, true);
});

test('répare une bible partielle sans perdre l’histoire générée', () => {
  const raw = structuredClone(legacy);
  raw.storyBible = {
    premise: 'Une petite dragonne explore une île.',
    theme: 'amitié',
    values: ['entraide'],
    stakes: 'Retrouver ses amis.',
    recurringObjects: ['une carte']
  };
  const story = normalizeStory(raw);
  assert.equal(story.storyBible.premise, raw.storyBible.premise);
  assert.match(story.storyBible.heroGoal, /quête/i);
  assert.deepEqual(story.storyBible.recurringObjects, ['une carte']);
});

test('préserve les nuances vocales usuelles au lieu de tout ramener à wonder', () => {
  assert.equal(normalizeNarrationMood('emotional'), 'sadness');
  assert.equal(normalizeNarrationMood('tense'), 'suspense');
  assert.equal(normalizeNarrationMood('celebration'), 'triumph');
});

test('mesure la durée sur chaque vraie route de lecture', () => {
  const shortStory = normalizeStory(legacy);
  const longRaw = structuredClone(legacy);
  for (const node of Object.values(longRaw.nodes)) node.text = 'émotion '.repeat(180);
  const shortMetrics = storyPathMetrics(shortStory, 120);
  const longMetrics = storyPathMetrics(normalizeStory(longRaw), 120);
  assert.equal(shortMetrics.pathCount, 2);
  assert.ok(shortMetrics.maxMinutes < longMetrics.minMinutes);
  assert.ok(longMetrics.minWords >= 360);
});

test('le prompt traite la durée et le souhait émotionnel comme des contraintes', () => {
  const input = { age: 7, duration: 10, hero: 'une dragonne', heroVoice: 'female', name: 'Lila', place: 'une île', theme: 'amitié', wish: 'tragique au début puis très heureux' };
  const request = buildFullStoryRequest(input);
  assert.match(request.instructions, /chaque route complète/);
  assert.match(request.instructions, /contrat éditorial prioritaire/);
  assert.match(request.instructions, /aucune mort/);
  const refinement = buildStoryRefinementRequest({ story: normalizeStory(legacy), input, metrics: storyPathMetrics(normalizeStory(legacy)) });
  assert.match(refinement.instructions, /souvenir concret/);
  assert.match(refinement.userInput, /tragique au début/);
});

test('refuse une histoire émotionnelle courte et vocalement plate', () => {
  const story = normalizeStory(legacy);
  const quality = assessGeneratedStory(story, { duration: 10, theme: 'amitié et émotions', wish: 'tragique au début' });
  assert.equal(quality.ok, false);
  assert.ok(quality.errors.some(error => error.includes('durée')));
  assert.ok(quality.errors.some(error => error.includes('émotionnel')));
  assert.ok(quality.errors.some(error => error.includes('début')));
});

test('parcourt correctement un ancien graphe à deux fins', () => {
  const story = normalizeStory(legacy);
  assert.deepEqual([...reachableNodeIds(story)].sort(), ['end-a', 'end-b', 'start']);
  assert.equal(validateStory(story).ok, false, 'le minimum de scènes reste volontairement strict');
});

test('le paquet de révision est privé par défaut', () => {
  const pack = buildReviewPackage(normalizeStory(legacy));
  assert.equal(pack.kind, 'child-story-review');
  assert.equal(pack.privacy.publicationAllowed, false);
  assert.equal(pack.story.schemaVersion, 2);
});

test('une continuation narrative rejoint le prochain embranchement', () => {
  const raw = structuredClone(legacy);
  raw.nodes.start.choices[0].next_node = 'consequence';
  raw.nodes.consequence = {
    id: 'consequence', headline: 'La conséquence', text: 'Un choix produit une conséquence visible avant que le récit ne continue vers une nouvelle décision importante pour la suite de cette aventure.',
    nextNode: 'end-a', choices: [], narration: { mood: 'wonder', pace: 'normal', intensity: 2 }
  };
  const story = normalizeStory(raw);
  assert.equal(story.nodes.consequence.question, '');
  assert.equal(story.nodes.consequence.nextNode, 'end-a');
  assert.ok(reachableNodeIds(story).has('consequence'));
});

test('conserve les choix appris dans un export réimportable', () => {
  const story = normalizeStory(legacy);
  story.nodes.start.choices[0].learned = true;
  story.nodes.start.choices[0].playCount = 3;
  const portable = storyToPortable(story);
  assert.equal(portable.nodes.find(node => node.id === 'start').choices[0].learned, true);
  assert.equal(portable.nodes.find(node => node.id === 'start').choices[0].playCount, 3);
});

test('affiche un mélange stable de deux ou trois choix accumulés', () => {
  const node = { choices: [
    { id: 'a', learned: false }, { id: 'b', learned: false },
    { id: 'c', learned: true }, { id: 'd', learned: true }
  ] };
  const first = pickDisplayChoices(node, () => 0.2);
  const second = pickDisplayChoices(node, () => 0.9);
  assert.equal(first, second);
  assert.equal(first.length, 3);
  assert.ok(first.some(choice => choice.learned));
  assert.ok(first.some(choice => !choice.learned));
});

test('comprend un choix prononcé par son numéro affiché', () => {
  const choices = [{ id: 'a', label: 'La forêt' }, { id: 'b', label: 'Le bateau' }, { id: 'c', label: 'La lune' }];
  assert.equal(matchSpokenChoice({ choices }, 'je veux le choix numéro deux', choices)?.id, 'b');
  assert.equal(matchSpokenChoice({ choices }, 'le troisième', choices)?.id, 'c');
  assert.equal(matchSpokenChoice({ choices }, 'choix rouge', choices)?.id, 'b');
  assert.equal(matchSpokenChoice({ choices }, 'un passage secret', choices), null);
});

test('illustre le passage éditorial et replie un brouillon sur sa couverture', () => {
  const story = { coverImage: './cover.jpg' };
  const editorial = { choice: 'La forêt', illustration: './assets/stories/test/choices/forest.jpg', learned: false };
  const learned = { choice: 'Une fusée', illustration: './assets/choices/choice-1.svg', learned: true };
  assert.equal(currentPassageImage(story, [editorial]), editorial.illustration);
  assert.equal(currentPassageImage(story, [editorial, learned]), story.coverImage);
  assert.equal(displayChoiceImage(learned, 1), './assets/choices/choice-2.svg');
  assert.equal(displayChoiceImage(learned, 1, '2-5'), './assets/choices/choice-vert.svg');
  assert.deepEqual([0, 1, 2].map(generatedChoiceColor), ['bleu', 'vert', 'rouge']);
});

test('fabrique et relit un ZIP autonome sans dépendance externe', async () => {
  const zip = await createZip([
    { name: 'story.json', data: '{"title":"Étoile"}' },
    { name: 'audio/mp3/scene.mp3', data: new Uint8Array([1, 2, 3, 4]) }
  ]);
  const files = await readZip(zip);
  assert.equal(JSON.parse(decodeZipText(files.get('story.json'))).title, 'Étoile');
  assert.deepEqual([...files.get('audio/mp3/scene.mp3')], [1, 2, 3, 4]);
});

test('une création commence directement par sa première décision', () => {
  const story = normalizeStory({
    ...legacy,
    source: 'child-draft',
    start_node: 'prologue',
    nodes: {
      ...legacy.nodes,
      prologue: { text: 'Le départ est raconté.', next_node: 'start', choices: [] }
    }
  }, { source: 'child-draft' });
  const harmonized = harmonizeCreatedStoryOpening(story);
  assert.equal(harmonized.startNode, 'start');
  assert.match(harmonized.nodes.start.text, /^Le départ est raconté\./);
  assert.equal(harmonized.nodes.prologue, undefined);
});
