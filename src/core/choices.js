const displayedByNode = new WeakMap();

function shuffled(values, random) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

export function pickDisplayChoices(node, random = Math.random) {
  const choices = node?.choices || [];
  if (choices.length <= 3) return choices;
  if (displayedByNode.has(node)) return displayedByNode.get(node);

  const count = random() < 0.7 ? 3 : 2;
  const learned = shuffled(choices.filter(choice => choice.learned), random);
  const editorial = shuffled(choices.filter(choice => !choice.learned), random);
  const selected = [];
  if (editorial.length) selected.push(editorial.shift());
  if (learned.length) selected.push(learned.shift());
  selected.push(...shuffled([...editorial, ...learned], random).slice(0, count - selected.length));
  displayedByNode.set(node, selected);
  return selected;
}

export function matchSpokenChoice(node, transcript, displayedChoices = node?.choices || []) {
  const heard = String(transcript || '').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const numbered = [
    /(?:\b(?:choix|numero)\s*(?:numero\s*)?(?:1|un|une)\b|\b(?:premier|premiere)\b|^(?:le\s*)?(?:1|un|une)$)/,
    /(?:\b(?:choix|numero)\s*(?:numero\s*)?(?:2|deux)\b|\b(?:deuxieme|second|seconde)\b|^(?:le\s*)?(?:2|deux)$)/,
    /(?:\b(?:choix|numero)\s*(?:numero\s*)?(?:3|trois)\b|\btroisieme\b|^(?:le\s*)?(?:3|trois)$)/
  ];
  const numberedIndex = numbered.findIndex(pattern => pattern.test(heard));
  if (numberedIndex >= 0 && displayedChoices[numberedIndex]) return displayedChoices[numberedIndex];
  const colors = ['bleu', 'rouge', 'vert'];
  const colorIndex = colors.findIndex(color => new RegExp(`^(?:(?:le|la)\\s+)?(?:choix\\s+|couleur\\s+)?${color}e?$`).test(heard));
  if (colorIndex >= 0 && displayedChoices[colorIndex]) return displayedChoices[colorIndex];
  return displayedChoices.find(choice => {
    const label = choice.label.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return heard.includes(label) || label.split(/\s+/).filter(word => word.length > 3).some(word => heard.includes(word));
  }) || null;
}
