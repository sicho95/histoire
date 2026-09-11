const ORDINALS = ['Choix numéro 1', 'Choix numéro 2', 'Choix numéro 3'];

export function buildSpokenChoicePrompt(question, choices = []) {
  const labels = choices.map(choice => typeof choice === 'string' ? choice : choice?.label).filter(Boolean).slice(0, 3);
  const options = labels.map((label, index) => `${ORDINALS[index]} : ${label}.`).join(' ');
  const numbers = labels.map((_, index) => index + 1).join(', ');
  return `À toi de choisir… ${question} ${options} Prends ton temps, puis touche l’image ${numbers}.`.replace(/\s+/g, ' ').trim();
}
