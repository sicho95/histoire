import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewPackage, normalizeStory, reachableNodeIds, storyToPortable, validateStory } from '../src/core/story-model.js';
import { pickDisplayChoices } from '../src/core/choices.js';
import { createZip, decodeZipText, readZip } from '../src/export/zip.js';

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

test('fabrique et relit un ZIP autonome sans dépendance externe', async () => {
  const zip = await createZip([
    { name: 'story.json', data: '{"title":"Étoile"}' },
    { name: 'audio/mp3/scene.mp3', data: new Uint8Array([1, 2, 3, 4]) }
  ]);
  const files = await readZip(zip);
  assert.equal(JSON.parse(decodeZipText(files.get('story.json'))).title, 'Étoile');
  assert.deepEqual([...files.get('audio/mp3/scene.mp3')], [1, 2, 3, 4]);
});
