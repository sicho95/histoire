import { detectStoryIntent } from './story-intent.js';

const MOODS = new Set(['wonder', 'joy', 'mystery', 'suspense', 'gentle_fear', 'sadness', 'calm', 'triumph']);
const MOOD_ALIASES = new Map([
  ['adventure', 'wonder'], ['adventurous', 'wonder'], ['curiosity', 'wonder'], ['amazement', 'wonder'], ['émerveillement', 'wonder'],
  ['happy', 'joy'], ['happiness', 'joy'], ['excited', 'joy'], ['excitement', 'joy'], ['joie', 'joy'],
  ['mysterious', 'mystery'], ['intrigue', 'mystery'], ['mystère', 'mystery'],
  ['tense', 'suspense'], ['tension', 'suspense'], ['stress', 'suspense'],
  ['fear', 'gentle_fear'], ['scared', 'gentle_fear'], ['soft_fear', 'gentle_fear'], ['peur', 'gentle_fear'],
  ['sad', 'sadness'], ['emotional', 'sadness'], ['emotion', 'sadness'], ['triste', 'sadness'], ['tristesse', 'sadness'],
  ['peaceful', 'calm'], ['gentle', 'calm'], ['tender', 'calm'], ['calme', 'calm'], ['tendresse', 'calm'],
  ['victory', 'triumph'], ['celebration', 'triumph'], ['hope', 'triumph'], ['triomphe', 'triumph'], ['espoir', 'triumph']
]);

export function slugify(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
}

export function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function normalizeChoice(raw, index) {
  return {
    id: raw.id || `choice-${index + 1}`,
    label: String(raw.label || `Choix ${index + 1}`).trim(),
    emoji: raw.emoji || raw.fallback_emoji || '✨',
    illustration: raw.illustration || '',
    nextNode: raw.nextNode || raw.next_node || '',
    consequenceHint: raw.consequenceHint || raw.consequence_hint || '',
    learned: Boolean(raw.learned ?? raw.is_learned),
    playCount: Number(raw.playCount ?? raw.play_count ?? 0)
  };
}

export function normalizeNarrationMood(value) {
  const mood = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (MOODS.has(mood)) return mood;
  return MOOD_ALIASES.get(mood) || 'wonder';
}

function normalizeNode(raw, id) {
  const choices = (raw.choices || []).map(normalizeChoice);
  const nextNode = raw.nextNode || raw.next_node || '';
  const terminal = raw.isEnding ?? raw.is_ending ?? (choices.length === 0 && !nextNode);
  const narration = raw.narration || {};
  return {
    id: raw.id || id,
    headline: String(raw.headline || id || 'Une nouvelle scène').trim(),
    coverEmoji: raw.coverEmoji || raw.cover_emoji || '📖',
    text: String(raw.text || '').trim(),
    question: terminal || nextNode ? '' : String(raw.question || 'Que choisis-tu ?').trim(),
    isEnding: Boolean(terminal),
    nextNode,
    narration: {
      mood: normalizeNarrationMood(narration.mood),
      pace: ['slow', 'normal', 'lively'].includes(narration.pace) ? narration.pace : 'normal',
      intensity: Math.max(1, Math.min(3, Number(narration.intensity || 2)))
    },
    choices
  };
}

function normalizeStoryBible(raw, story) {
  const bible = raw?.storyBible || raw?.story_bible || {};
  const rawValues = Array.isArray(bible.values) && bible.values.length ? bible.values : ['entraide'];
  const values = rawValues.map(value => String(value).trim()).filter(Boolean).slice(0, 4);
  const rawRecurringObjects = Array.isArray(bible.recurringObjects || bible.recurring_objects)
    && (bible.recurringObjects || bible.recurring_objects).length
    ? (bible.recurringObjects || bible.recurring_objects)
    : ['un objet important de l’aventure'];
  const recurringObjects = rawRecurringObjects.map(value => String(value).trim()).filter(Boolean).slice(0, 5);
  return {
    premise: String(bible.premise || story.intro || 'Une aventure à choix racontée à un enfant.').trim(),
    theme: String(bible.theme || story.theme || 'aventure et émotions').trim(),
    values: values.length ? values : ['entraide'],
    heroGoal: String(bible.heroGoal || bible.hero_goal || 'Mener sa quête jusqu’au bout et protéger ses amis.').trim(),
    stakes: String(bible.stakes || 'Trouver une solution sûre avant que l’aventure ne se termine.').trim(),
    recurringObjects: recurringObjects.length ? recurringObjects : ['un objet important de l’aventure']
  };
}

export function normalizeStory(raw, meta = {}) {
  if (!raw || typeof raw !== 'object') throw new TypeError('Une histoire doit être un objet JSON.');
  const rawNodes = Array.isArray(raw.nodes)
    ? Object.fromEntries(raw.nodes.map(node => [node.id, node]))
    : (raw.nodes || {});
  const nodes = Object.fromEntries(Object.entries(rawNodes).map(([id, node]) => [id, normalizeNode(node, id)]));
  const id = slugify(raw.id || raw.title) || `histoire-${Date.now()}`;
  return {
    schemaVersion: 2,
    id,
    title: String(raw.title || 'Histoire sans titre').trim(),
    coverEmoji: raw.coverEmoji || raw.cover_emoji || raw.cover || '📖',
    coverImage: raw.coverImage || raw.cover_image || '',
    intro: String(raw.intro || '').trim(),
    ageRange: raw.ageRange || raw.age_range || '4–8 ans',
    ageBand: raw.ageBand || raw.age_band || '5-9',
    heroVoice: raw.heroVoice || raw.hero_voice || 'female',
    featuredOrder: Number(raw.featuredOrder ?? raw.featured_order ?? 999),
    durationMinutes: Math.max(5, Number(raw.durationMinutes || raw.duration_minutes || 15)),
    startNode: raw.startNode || raw.start_node || 'start',
    storyBible: normalizeStoryBible(raw, raw),
    nodes,
    source: meta.source || raw.source || (raw.is_user_created ? 'child-draft' : 'import'),
    revision: Number(meta.revision ?? raw.revision ?? 1),
    status: raw.status || (meta.source === 'github' ? 'published' : 'draft'),
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString()
  };
}

export function harmonizeCreatedStoryOpening(input) {
  const story = structuredClone(input);
  if (story.source !== 'child-draft') return story;
  const preludeIds = [];
  let node = story.nodes[story.startNode];
  const seen = new Set();
  while (node && node.nextNode && !node.choices.length && !node.isEnding && !seen.has(node.id)) {
    seen.add(node.id);
    preludeIds.push(node.id);
    node = story.nodes[node.nextNode];
  }
  if (!preludeIds.length || !node || node.choices.length < 2 || !node.question) return story;
  const prelude = preludeIds.map(id => story.nodes[id]?.text).filter(Boolean);
  node.text = [...prelude, node.text].join('\n\n');
  story.startNode = node.id;
  for (const id of preludeIds) delete story.nodes[id];
  return story;
}

export function storyToPortable(story) {
  const normalized = normalizeStory(story, { source: story.source, revision: story.revision });
  return {
    schemaVersion: 2,
    id: normalized.id,
    title: normalized.title,
    coverEmoji: normalized.coverEmoji,
    coverImage: normalized.coverImage,
    intro: normalized.intro,
    ageRange: normalized.ageRange,
    ageBand: normalized.ageBand,
    heroVoice: normalized.heroVoice,
    featuredOrder: normalized.featuredOrder,
    durationMinutes: normalized.durationMinutes,
    startNode: normalized.startNode,
    storyBible: normalized.storyBible,
    nodes: Object.values(normalized.nodes).map(node => ({
      id: node.id,
      headline: node.headline,
      coverEmoji: node.coverEmoji,
      text: node.text,
      question: node.question,
      isEnding: node.isEnding,
      nextNode: node.nextNode,
      narration: node.narration,
      choices: node.choices.map(choice => ({
        id: choice.id,
        label: choice.label,
        emoji: choice.emoji,
        illustration: choice.illustration,
        nextNode: choice.nextNode,
        consequenceHint: choice.consequenceHint,
        learned: choice.learned,
        playCount: choice.playCount
      }))
    })),
    creationContext: story.creationContext || null,
    playedPath: story.playedPath || [],
    source: normalized.source,
    revision: normalized.revision,
    status: normalized.status,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt
  };
}

export function reachableNodeIds(story) {
  const seen = new Set();
  const stack = [story.startNode];
  while (stack.length) {
    const id = stack.pop();
    if (!id || seen.has(id) || !story.nodes[id]) continue;
    seen.add(id);
    if (story.nodes[id].nextNode) stack.push(story.nodes[id].nextNode);
    for (const choice of story.nodes[id].choices) stack.push(choice.nextNode);
  }
  return seen;
}

export function validateStory(input, { editorial = false } = {}) {
  const story = normalizeStory(input, { source: input.source, revision: input.revision });
  const errors = [];
  const warnings = [];
  const nodes = Object.values(story.nodes);
  if (!story.id) errors.push('Identifiant manquant.');
  if (story.title.length < 3) errors.push('Titre trop court.');
  if (!story.nodes[story.startNode]) errors.push(`Scène de départ introuvable : ${story.startNode}.`);
  if (nodes.length < 6) errors.push('Une histoire doit contenir au moins 6 scènes.');

  for (const node of nodes) {
    const editorialMinimum = node.nextNode
      ? (story.nodes[node.nextNode]?.isEnding ? 20 : 45)
      : story.ageBand === '2-5' ? 55 : 75;
    if (wordCount(node.text) < (node.isEnding ? 45 : editorial ? editorialMinimum : 80)) {
      warnings.push(`${node.id} est courte (${wordCount(node.text)} mots).`);
    }
    if (node.isEnding && node.choices.length) errors.push(`${node.id} est une fin mais propose encore des choix.`);
    if (!node.isEnding && !node.nextNode && node.choices.length < 2) errors.push(`${node.id} doit proposer au moins 2 choix ou une continuation narrative.`);
    if (node.nextNode && !story.nodes[node.nextNode]) errors.push(`${node.id} pointe vers une continuation absente : ${node.nextNode}.`);
    const labels = new Set();
    for (const choice of node.choices) {
      if (!choice.nextNode || !story.nodes[choice.nextNode]) errors.push(`${node.id} pointe vers une scène absente : ${choice.nextNode || 'vide'}.`);
      const key = choice.label.toLocaleLowerCase('fr');
      if (labels.has(key)) errors.push(`${node.id} contient deux choix identiques : ${choice.label}.`);
      labels.add(key);
    }
    if (node.choices.length > 1 && new Set(node.choices.map(choice => choice.nextNode)).size === 1) {
      warnings.push(`${node.id} donne la même conséquence à tous les choix.`);
    }
  }

  const reachable = reachableNodeIds(story);
  const unreachable = nodes.filter(node => !reachable.has(node.id)).map(node => node.id);
  if (unreachable.length) errors.push(`Scènes inaccessibles : ${unreachable.join(', ')}.`);
  const endings = nodes.filter(node => node.isEnding && reachable.has(node.id));
  if (endings.length < 3) errors.push('Il faut au moins 3 fins réellement accessibles.');
  return { ok: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)], story };
}

function spokenChoiceWordCount(node) {
  if (!node?.question || !node.choices?.length) return 0;
  const labels = node.choices.reduce((sum, choice) => sum + wordCount(choice.label), 0);
  return wordCount(node.question) + labels + 13 + node.choices.length * 3;
}

export function storyPathMetrics(input, wordsPerMinute) {
  const story = normalizeStory(input, { source: input.source, revision: input.revision });
  const wpm = Number(wordsPerMinute) || (story.ageBand === '2-5' ? 120 : 145);
  const openingWords = wordCount(`${story.title}. ${story.intro}`);
  const memo = new Map();

  function measure(nodeId, trail = new Set()) {
    if (!nodeId || trail.has(nodeId) || trail.size > 80) return null;
    if (memo.has(nodeId)) return memo.get(nodeId);
    const node = story.nodes[nodeId];
    if (!node) return null;
    const ownWords = wordCount(node.text) + spokenChoiceWordCount(node);
    if (node.isEnding || (!node.nextNode && !node.choices.length)) {
      const result = { minWords: ownWords, maxWords: ownWords, averageWords: ownWords, pathCount: 1 };
      memo.set(nodeId, result);
      return result;
    }
    const nextTrail = new Set(trail).add(nodeId);
    const childIds = node.nextNode ? [node.nextNode] : node.choices.map(choice => choice.nextNode);
    const children = childIds.map(id => measure(id, nextTrail)).filter(Boolean);
    if (!children.length) return null;
    const result = {
      minWords: ownWords + Math.min(...children.map(child => child.minWords)),
      maxWords: ownWords + Math.max(...children.map(child => child.maxWords)),
      averageWords: ownWords + children.reduce((sum, child) => sum + child.averageWords, 0) / children.length,
      pathCount: Math.min(Number.MAX_SAFE_INTEGER, children.reduce((sum, child) => sum + child.pathCount, 0))
    };
    memo.set(nodeId, result);
    return result;
  }

  const measured = measure(story.startNode) || {
    minWords: Object.values(story.nodes).reduce((sum, node) => sum + wordCount(node.text), 0),
    maxWords: Object.values(story.nodes).reduce((sum, node) => sum + wordCount(node.text), 0),
    averageWords: Object.values(story.nodes).reduce((sum, node) => sum + wordCount(node.text), 0),
    pathCount: 1
  };
  const minWords = openingWords + measured.minWords;
  const maxWords = openingWords + measured.maxWords;
  const averageWords = openingWords + measured.averageWords;
  return {
    wordsPerMinute: wpm,
    pathCount: measured.pathCount,
    minWords,
    maxWords,
    averageWords,
    minMinutes: minWords / wpm,
    maxMinutes: maxWords / wpm,
    averageMinutes: averageWords / wpm
  };
}

export function estimateDurationMinutes(story, wordsPerMinute) {
  return Math.max(1, Math.round(storyPathMetrics(story, wordsPerMinute).averageMinutes));
}

export function assessGeneratedStory(story, input) {
  const metrics = storyPathMetrics(story);
  const targetMinutes = Math.max(1, Number(input?.duration || story.durationMinutes || 10));
  const errors = [];
  if (metrics.minMinutes < targetMinutes * .9) {
    errors.push(`durée minimale ${Math.max(1, Math.round(metrics.minMinutes))} min au lieu de ${targetMinutes}`);
  }
  if (metrics.maxMinutes > targetMinutes * 1.15) {
    errors.push(`durée maximale ${Math.round(metrics.maxMinutes)} min au lieu de ${targetMinutes}`);
  }

  const intent = detectStoryIntent(input);
  if (intent.strongEmotion) {
    const nodes = Object.values(story.nodes);
    const moods = new Set(nodes.map(node => node.narration.mood));
    if (moods.size < 4 || !moods.has('sadness') || ![...moods].some(mood => mood === 'joy' || mood === 'triumph')) {
      errors.push('arc émotionnel et intentions vocales insuffisamment variés');
    }
    if (intent.tragicOpening && !['sadness', 'suspense', 'gentle_fear'].includes(story.nodes[story.startNode]?.narration?.mood)) {
      errors.push('rupture émotionnelle absente du début');
    }
    const endings = nodes.filter(node => node.isEnding);
    if (endings.some(node => !['joy', 'triumph', 'calm'].includes(node.narration.mood))) {
      errors.push('toutes les fins ne portent pas la résolution heureuse demandée');
    }
  }
  if (intent.gentleFright) {
    const nodes = Object.values(story.nodes);
    const moods = new Set(nodes.map(node => node.narration.mood));
    if (!moods.has('mystery') || !moods.has('suspense') || !moods.has('gentle_fear')) {
      errors.push('montée de mystère, suspense et peur douce insuffisante');
    }
    if (!nodes.some(node => ['suspense', 'gentle_fear'].includes(node.narration.mood) && node.narration.intensity === 3)) {
      errors.push('pic de frisson vocal absent');
    }
    if (intent.frightIntensity === 'strong') {
      const tenseNodes = nodes.filter(node => ['mystery', 'suspense', 'gentle_fear'].includes(node.narration.mood));
      const peaks = nodes.filter(node => ['suspense', 'gentle_fear'].includes(node.narration.mood) && node.narration.intensity === 3);
      if (tenseNodes.length < 4 || peaks.length < 2) errors.push('frisson renforcé insuffisant pour donner la chair de poule');
    }
    const endings = nodes.filter(node => node.isEnding);
    if (endings.some(node => !['calm', 'joy', 'triumph'].includes(node.narration.mood))) {
      errors.push('toutes les fins du doux frisson ne sont pas rassurantes');
    }
  }
  return { ok: errors.length === 0, errors, metrics };
}

export function buildReviewPackage(story, context = {}) {
  const clean = storyToPortable(story);
  return {
    packageVersion: 1,
    kind: 'child-story-review',
    exportedAt: new Date().toISOString(),
    privacy: {
      publicationAllowed: false,
      parentReviewRequired: true,
      checklist: [
        'Retirer le nom complet de l’enfant',
        'Retirer école, adresse, voix et autres informations personnelles',
        'Confirmer l’autorisation parentale avant publication publique'
      ]
    },
    editorialRequest: {
      status: 'to-review',
      goals: ['cohérence', 'style oral', 'embranchements utiles', 'sécurité enfant', 'narration expressive'],
      notes: context.notes || ''
    },
    creationContext: context.creationContext || null,
    playedPath: context.playedPath || [],
    story: clean
  };
}
