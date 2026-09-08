const GENERIC_CHOICE_ILLUSTRATIONS = ['explorer', 'ecouter', 'aider', 'courage', 'inventer', 'observer', 'chanter', 'suivre', 'partager', 'attendre', 'demander', 'rentrer']
  .map(name => `./assets/choices/${name}.svg`);

const choiceSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'label', 'emoji', 'illustration', 'nextNode', 'consequenceHint'],
  properties: {
    id: { type: 'string' },
    label: { type: 'string' },
    emoji: { type: 'string' },
    nextNode: { type: 'string' },
    consequenceHint: { type: 'string' },
    illustration: { type: 'string', enum: GENERIC_CHOICE_ILLUSTRATIONS }
  }
};

const narrationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['mood', 'pace', 'intensity'],
  properties: {
    mood: { type: 'string', enum: ['wonder', 'joy', 'mystery', 'suspense', 'gentle_fear', 'sadness', 'calm', 'triumph'] },
    pace: { type: 'string', enum: ['slow', 'normal', 'lively'] },
    intensity: { type: 'integer', minimum: 1, maximum: 3 }
  }
};

const nodeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'headline', 'coverEmoji', 'text', 'question', 'isEnding', 'narration', 'choices'],
  properties: {
    id: { type: 'string' },
    headline: { type: 'string' },
    coverEmoji: { type: 'string' },
    text: { type: 'string' },
    question: { type: 'string' },
    isEnding: { type: 'boolean' },
    narration: narrationSchema,
    choices: { type: 'array', minItems: 0, maxItems: 3, items: choiceSchema }
  }
};

export const STORY_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'id', 'title', 'coverEmoji', 'intro', 'ageRange', 'ageBand', 'heroVoice', 'durationMinutes', 'startNode', 'storyBible', 'nodes'],
  properties: {
    schemaVersion: { type: 'integer', enum: [2] },
    id: { type: 'string' },
    title: { type: 'string' },
    coverEmoji: { type: 'string' },
    intro: { type: 'string' },
    ageRange: { type: 'string' },
    ageBand: { type: 'string', enum: ['2-5', '5-9'] },
    heroVoice: { type: 'string', enum: ['female', 'male'] },
    durationMinutes: { type: 'integer', minimum: 6, maximum: 24 },
    startNode: { type: 'string' },
    storyBible: {
      type: 'object', additionalProperties: false,
      required: ['premise', 'theme', 'values', 'heroGoal', 'stakes', 'recurringObjects'],
      properties: {
        premise: { type: 'string' },
        theme: { type: 'string' },
        values: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string' } },
        heroGoal: { type: 'string' },
        stakes: { type: 'string' },
        recurringObjects: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string' } }
      }
    },
    nodes: { type: 'array', minItems: 10, maxItems: 40, items: nodeSchema }
  }
};

export const BRANCH_RESPONSE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['matchedChoiceId', 'scene', 'rejoinNodeId'],
  properties: {
    matchedChoiceId: { type: ['string', 'null'] },
    rejoinNodeId: { type: ['string', 'null'] },
    scene: { anyOf: [nodeSchema, { type: 'null' }] }
  }
};

const SAFETY = `Public : enfant de 2 à 9 ans selon l’âge demandé. Aucun contenu sexuel, humiliant, discriminatoire, dangereux à reproduire ou graphiquement violent. La peur reste légère, brève et toujours résolue par une action rassurante. Pas de morale assénée : les valeurs apparaissent dans les conséquences.`;

export function buildFullStoryRequest(input) {
  const age = Number(input.age || 7);
  const duration = Number(input.duration || 10);
  const preschool = age <= 4;
  const sceneWords = preschool ? '60 à 110 mots, avec répétitions et phrases simples' : '90 à 190 mots, avec dialogues courts et détails sensoriels';
  const nodeGuide = duration >= 18 ? '28 à 36 scènes, dont 9 à 11 moments de choix' : duration >= 10 ? '18 à 25 scènes, dont 5 à 7 moments de choix' : '15 à 21 scènes, dont 4 à 6 moments de choix';
  const choiceTiming = `Un moment de choix doit arriver toutes les 45 à 150 secondes de narration, jamais plus rapproché que 45 secondes pour une histoire courte.`;
  const instructions = `Tu es auteur et architecte de contes interactifs français. ${SAFETY}

Écris une aventure complète et cohérente, pensée pour être racontée à voix haute. Construis une progression en trois actes : désir clair, complications croissantes, résolution gagnée par les décisions de l'enfant. Chaque choix doit provoquer une conséquence visible dès la scène suivante. Les branches peuvent se rejoindre, mais jamais immédiatement et jamais sans conserver la conséquence du choix. Prévois au moins trois fins distinctes et accessibles.

Exigences éditoriales :
- durée cible : ${duration} minutes à l’oral ;
- ${nodeGuide} ;
- scènes de ${sceneWords}, fins de 60 à 140 mots ;
- ${choiceTiming}
- dialogues courts, vocabulaire concret, détails sensoriels variés ;
- personnages, objets et règles du monde parfaitement constants ;
- 2 ou 3 choix courts à chaque moment de décision, menant à des conséquences différentes ;
- pour chaque choix, utilise uniquement le pictogramme générique le plus clair parmi : ${GENERIC_CHOICE_ILLUSTRATIONS.join(', ')} ;
- trois émotions ou intensités différentes au fil du récit ;
- aucune mention de modèle, prompt, génération, nœud ou embranchement.

Les identifiants sont des slugs ASCII uniques. Les fins ont isEnding=true, question vide et choices vide. Les autres scènes ont isEnding=false et 2 ou 3 choix. Tous les nextNode existent. Toutes les scènes sont accessibles depuis startNode.`;
  const userInput = `Crée maintenant l'histoire demandée.
Héros : ${input.hero}.
Prénom d'usage : ${input.name || 'un prénom inventé adapté'}.
Univers : ${input.place}.
Genre : ${input.theme}.
Élément souhaité par l'enfant : ${input.wish || 'surprise libre'}.
Âge : ${age} ans.
Durée cible : ${duration} minutes.
Choisis heroVoice="female" si le personnage principal est présenté comme une héroïne, heroVoice="male" s’il est présenté comme un héros. Utilise ageBand="2-5" jusqu’à 4 ans, sinon ageBand="5-9".
Le prénom fourni est un prénom d'usage seulement : n'invente aucune donnée personnelle.`;
  return { instructions, userInput };
}

export function buildBranchRequest({ story, node, transcript, path }) {
  const choices = node.choices.map(choice => `${choice.id}: ${choice.label}`).join(' | ');
  const candidates = Object.values(story.nodes)
    .filter(candidate => !candidate.isEnding && candidate.id !== node.id)
    .slice(0, 8)
    .map(candidate => `${candidate.id}: ${candidate.headline}`).join(' | ');
  const instructions = `Tu prolonges un conte interactif déjà en cours. ${SAFETY}
Si la parole correspond clairement à un choix existant, renseigne matchedChoiceId et laisse scene/rejoinNodeId à null. Sinon, crée une vraie scène de 180 à 260 mots qui réalise concrètement l'idée de l'enfant, conserve la bible du récit, produit une conséquence et propose 2 ou 3 choix. La nouvelle scène pourra rejoindre plus tard une scène existante pertinente, sans effacer ce qui vient de se passer.`;
  const userInput = `Titre : ${story.title}
Bible : ${JSON.stringify(story.storyBible)}
Scène actuelle : ${node.headline}
Choix existants : ${choices || 'aucun'}
Chemin déjà parcouru : ${(path || []).map(step => step.headline).join(' > ')}
Scènes possibles pour rejoindre le récit : ${candidates || 'aucune'}
Parole exacte de l'enfant : ${transcript}`;
  return { instructions, userInput };
}
