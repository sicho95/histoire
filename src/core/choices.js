function shuffle(arr) { const copy = [...arr]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; }
export function pickDisplayChoices(node) {
  const base = [...(node.choices || [])];
  if (base.length === 3) base.push({ label: 'Surprise', fallback_emoji: '🎲', __random: true, is_random: true });
  if (base.length <= 4) return shuffle(base);
  const selected = [];
  const original = base.find(c => c.is_original);
  const favorite = base.slice().sort((a,b) => (b.play_count || 0) - (a.play_count || 0))[0];
  const learned = base.find(c => c.is_learned);
  [original, favorite, learned].forEach(c => { if (c && !selected.includes(c)) selected.push(c); });
  const remaining = base.filter(c => !selected.includes(c));
  if (remaining.length) selected.push(remaining[Math.floor(Math.random()*remaining.length)]);
  return shuffle(selected.slice(0, 4));
}
