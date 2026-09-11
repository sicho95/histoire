export function isEditorialChoiceArt(choice) {
  return !choice?.learned && String(choice?.illustration || '').includes('/assets/stories/');
}

export function currentPassageImage(story, path = []) {
  const latestChoice = [...path].reverse().find(step => Object.hasOwn(step, 'choice'));
  return isEditorialChoiceArt(latestChoice) ? latestChoice.illustration : (story?.coverImage || '');
}

export function displayChoiceImage(choice, index) {
  return isEditorialChoiceArt(choice) ? choice.illustration : `./assets/choices/choice-${index + 1}.svg`;
}
