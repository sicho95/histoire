function uniquePush(list, item) { if (item && !list.includes(item)) list.push(item); }
export function pickDisplayChoices(node) {
  const choices = [...(node.choices || [])].filter(choice => !choice.__random);
  if (!choices.length) return [];
  const ordered = [];
  const original = choices.find(choice => choice.is_original) || choices[0];
  const preferred = choices.filter(choice => choice !== original).sort((a, b) => (b.play_count || 0) - (a.play_count || 0))[0];
  const learned = choices.find(choice => choice.is_learned && choice !== original && choice !== preferred);
  uniquePush(ordered, original);
  uniquePush(ordered, preferred);
  uniquePush(ordered, learned);
  for (const choice of choices) {
    if (ordered.length >= 3) break;
    uniquePush(ordered, choice);
  }
  const randomPool = choices.filter(choice => !ordered.includes(choice));
  ordered.push({ label: 'Surprise', fallback_emoji: '🎲', __random: true, pool: randomPool.length ? randomPool : choices });
  return ordered.slice(0, 4);
}
