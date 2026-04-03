function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export function pickDisplayChoices(node) {
  const choices = [...(node.choices || [])];
  if (choices.length <= 4) return shuffle(choices);
  const selected = [];
  const original = choices.find(c => c.is_original);
  const favorite = choices.slice().sort((a, b) => (b.play_count || 0) - (a.play_count || 0))[0];
  const learned = choices.find(c => c.is_learned);
  [original, favorite, learned].forEach(choice => {
    if (choice && !selected.includes(choice)) selected.push(choice);
  });
  const remaining = choices.filter(choice => !selected.includes(choice));
  if (remaining.length) selected.push(remaining[Math.floor(Math.random() * remaining.length)]);
  return shuffle(selected.slice(0, 4));
}
