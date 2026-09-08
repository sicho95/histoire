import { queryStructured } from '../api/router.js';
import { BRANCH_RESPONSE_SCHEMA, buildBranchRequest } from '../api/prompts.js';
import { normalizeStory } from './story-model.js';
import { saveDraft } from '../storage/database.js';
import { matchSpokenChoice } from './choices.js';

function allowedRejoinIds(story, node) {
  return [...new Set(node.choices
    .filter(choice => !choice.learned)
    .map(choice => story.nodes[choice.nextNode])
    .map(target => target?.nextNode || target?.id)
    .filter(id => id && story.nodes[id]))];
}

export function attachGeneratedBranch({ story, node, transcript, data }) {
  const choices = data.scene?.choices || [];
  const consequences = data.consequences || [];
  if (choices.length < 2 || choices.length > 3 || consequences.length !== choices.length) {
    throw new Error('Cette nouvelle piste est incomplète. Essaie de redire ton idée en quelques mots.');
  }
  const allowed = allowedRejoinIds(story, node);
  const rejoinNodeId = allowed.includes(data.rejoinNodeId) ? data.rejoinNodeId : allowed[0];
  if (!rejoinNodeId) throw new Error('Cette partie de l’histoire ne permet pas encore d’ajouter une autre idée.');

  const sceneId = `idea-${Date.now().toString(36)}`;
  const scene = {
    ...data.scene,
    id: sceneId,
    isEnding: false,
    nextNode: '',
    choices: choices.map((choice, index) => ({
      ...choice,
      id: `${sceneId}-choice-${index + 1}`,
      nextNode: `${sceneId}-suite-${index + 1}`
    }))
  };
  story.nodes[sceneId] = scene;
  consequences.forEach((consequence, index) => {
    const id = `${sceneId}-suite-${index + 1}`;
    story.nodes[id] = {
      ...consequence,
      id,
      question: '',
      isEnding: false,
      nextNode: rejoinNodeId,
      choices: []
    };
  });

  const learnedChoice = {
    id: `${sceneId}-entry`,
    label: transcript.slice(0, 48),
    emoji: scene.coverEmoji || '✨',
    illustration: scene.choices[0]?.illustration || './assets/choices/inventer.svg',
    nextNode: sceneId,
    consequenceHint: scene.text.slice(0, 120),
    learned: true
  };
  node.choices.push(learnedChoice);
  return learnedChoice;
}

export async function weaveChoice({ story, node, transcript, path }) {
  const localMatch = matchSpokenChoice(node, transcript);
  if (localMatch) return { matchedChoice: localMatch, created: false };

  const request = buildBranchRequest({ story, node, transcript, path });
  const { data } = await queryStructured({
    name: 'child_story_branch',
    schema: BRANCH_RESPONSE_SCHEMA,
    ...request,
    maxOutputTokens: 4800
  });
  const modelMatch = node.choices.find(choice => choice.id === data.matchedChoiceId);
  if (modelMatch) return { matchedChoice: modelMatch, created: false };
  if (!data.scene) throw new Error('Je n’ai pas compris cette idée. Essaie avec quelques mots simples.');

  const learnedChoice = attachGeneratedBranch({ story, node, transcript, data });
  const normalized = normalizeStory({ ...story, status: 'draft', source: 'child-draft' }, { source: 'child-draft' });
  await saveDraft(normalized, story.creationContext);
  return { matchedChoice: learnedChoice, created: true, story: normalized };
}
