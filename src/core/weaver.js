import { queryStructured } from '../api/router.js';
import { BRANCH_RESPONSE_SCHEMA, buildBranchRequest } from '../api/prompts.js';
import { normalizeStory } from './story-model.js';
import { saveDraft } from '../storage/database.js';
import { matchSpokenChoice } from './choices.js';

export async function weaveChoice({ story, node, transcript, path }) {
  const localMatch = matchSpokenChoice(node, transcript);
  if (localMatch) return { matchedChoice: localMatch, created: false };

  const request = buildBranchRequest({ story, node, transcript, path });
  const { data } = await queryStructured({
    name: 'child_story_branch',
    schema: BRANCH_RESPONSE_SCHEMA,
    ...request,
    maxOutputTokens: 2600
  });
  const modelMatch = node.choices.find(choice => choice.id === data.matchedChoiceId);
  if (modelMatch) return { matchedChoice: modelMatch, created: false };
  if (!data.scene) throw new Error('Je n’ai pas compris cette idée. Essaie avec quelques mots simples.');

  const sceneId = `idea-${Date.now().toString(36)}`;
  const scene = { ...data.scene, id: sceneId };
  scene.choices = scene.choices.map((choice, index) => ({
    ...choice,
    id: `${sceneId}-choice-${index + 1}`,
    nextNode: index === 0 && data.rejoinNodeId && story.nodes[data.rejoinNodeId] ? data.rejoinNodeId : choice.nextNode
  })).filter(choice => story.nodes[choice.nextNode] || choice.nextNode === sceneId);

  if (scene.choices.length < 2) {
    const fallbackTargets = node.choices.map(choice => choice.nextNode).filter(id => story.nodes[id]);
    scene.choices = fallbackTargets.slice(0, 2).map((nextNode, index) => ({ id: `${sceneId}-return-${index}`, label: index ? 'Continuer autrement' : 'Suivre cette piste', emoji: index ? '🧭' : '✨', nextNode, consequenceHint: 'Rejoint l’aventure avec cette nouvelle idée.' }));
  }
  story.nodes[sceneId] = scene;
  const learnedChoice = { id: `${sceneId}-entry`, label: transcript.slice(0, 48), emoji: scene.coverEmoji || '✨', nextNode: sceneId, consequenceHint: 'L’idée inventée pendant la lecture.' };
  node.choices.push(learnedChoice);
  const normalized = normalizeStory({ ...story, status: 'draft', source: 'child-draft' }, { source: 'child-draft' });
  await saveDraft(normalized, story.creationContext);
  return { matchedChoice: learnedChoice, created: true, story: normalized };
}
