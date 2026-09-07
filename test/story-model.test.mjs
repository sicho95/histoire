import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewPackage, normalizeStory, reachableNodeIds, validateStory } from '../src/core/story-model.js';

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
