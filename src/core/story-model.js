const MOODS = new Set(['wonder', 'joy', 'mystery', 'suspense', 'gentle_fear', 'sadness', 'calm', 'triumph']);

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
      mood: MOODS.has(narration.mood) ? narration.mood : 'wonder',
      pace: ['slow', 'normal', 'lively'].includes(narration.pace) ? narration.pace : 'normal',
      intensity: Math.max(1, Math.min(3, Number(narration.intensity || 2)))
    },
    choices
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
    storyBible: raw.storyBible || raw.story_bible || {
      premise: raw.intro || '', theme: '', values: [], heroGoal: '', stakes: '', recurringObjects: []
    },
    nodes,
    source: meta.source || raw.source || (raw.is_user_created ? 'child-draft' : 'import'),
    revision: Number(meta.revision ?? raw.revision ?? 1),
    status: raw.status || (meta.source === 'github' ? 'published' : 'draft'),
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString()
  };
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
        consequenceHint: choice.consequenceHint
      }))
    })),
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
    const editorialMinimum = node.nextNode ? 45 : story.ageBand === '2-5' ? 55 : 75;
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

export function estimateDurationMinutes(story, wordsPerMinute = 135) {
  const reachable = Object.values(story.nodes);
  const averagePathNodes = Math.max(4, Math.ceil(reachable.length * 0.58));
  const averageWords = reachable.reduce((sum, node) => sum + wordCount(node.text), 0) / Math.max(1, reachable.length);
  return Math.max(5, Math.round((averageWords * averagePathNodes) / wordsPerMinute));
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
