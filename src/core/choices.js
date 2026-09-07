export function pickDisplayChoices(node) {
  return (node?.choices || []).slice(0, 3);
}

export function matchSpokenChoice(node, transcript) {
  const heard = String(transcript || '').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return (node?.choices || []).find(choice => {
    const label = choice.label.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return heard.includes(label) || label.split(/\s+/).filter(word => word.length > 3).some(word => heard.includes(word));
  }) || null;
}
