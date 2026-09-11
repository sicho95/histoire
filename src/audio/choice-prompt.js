import { preschoolChoiceColor } from '../core/illustrations.js';

const ORDINALS = ['Choix numéro 1', 'Choix numéro 2', 'Choix numéro 3'];

export function buildSpokenChoicePrompt(question, choices = [], { ageBand = '' } = {}) {
  const selected = choices.map(choice => typeof choice === 'string' ? { label: choice } : choice).filter(choice => choice?.label).slice(0, 3);
  const cues = selected.map((choice, index) => {
    const color = preschoolChoiceColor(choice, index, ageBand);
    return color ? `Choix ${color}` : ORDINALS[index];
  });
  const options = selected.map((choice, index) => `${cues[index]} : ${choice.label}.`).join(' ');
  const hasColor = cues.some(cue => !cue.includes('numéro'));
  const instruction = hasColor ? 'touche la couleur de ton choix' : `touche l’image ${selected.map((_, index) => index + 1).join(', ')}`;
  return `À toi de choisir… ${question} ${options} Prends ton temps, puis ${instruction}.`.replace(/\s+/g, ' ').trim();
}
