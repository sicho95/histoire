const ORDINALS = ['Premier choix', 'Deuxième choix', 'Troisième choix'];

export function buildSpokenChoicePrompt(question, choices = []) {
  const labels = choices.map(choice => typeof choice === 'string' ? choice : choice?.label).filter(Boolean).slice(0, 3);
  const options = labels.map((label, index) => `${ORDINALS[index]} : ${label}.`).join(' ');
  return `À toi de choisir… ${question} ${options} Prends ton temps, regarde bien les images, puis touche ton choix.`.replace(/\s+/g, ' ').trim();
}
