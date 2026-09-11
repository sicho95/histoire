export function isEditorialChoiceArt(choice) {
  return !choice?.learned && String(choice?.illustration || '').includes('/assets/stories/');
}

export function currentPassageImage(story, path = []) {
  const latestChoice = [...path].reverse().find(step => Object.hasOwn(step, 'choice'));
  return isEditorialChoiceArt(latestChoice) ? latestChoice.illustration : (story?.coverImage || '');
}

export const PRESCHOOL_CHOICE_COLORS = ['bleu', 'rouge', 'vert'];

export function preschoolChoiceColor(choice, index, ageBand) {
  if (ageBand !== '2-5' || isEditorialChoiceArt(choice)) return '';
  return PRESCHOOL_CHOICE_COLORS[index] || PRESCHOOL_CHOICE_COLORS.at(-1);
}

export function displayChoiceImage(choice, index, ageBand) {
  if (isEditorialChoiceArt(choice)) return choice.illustration;
  const color = preschoolChoiceColor(choice, index, ageBand);
  return color ? `./assets/choices/choice-${color}.svg` : `./assets/choices/choice-${index + 1}.svg`;
}
