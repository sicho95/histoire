export function detectStoryIntent(input = {}) {
  const theme = String(input.theme || '').toLocaleLowerCase('fr');
  const wish = String(input.wish || '').toLocaleLowerCase('fr');
  const text = `${theme} ${wish}`;
  const gentleFright = /frisson|peur|effray|stress|angoiss|inquiét/.test(text);
  const strongerFright = gentleFright && /chair de poule|plus de (?:peur|frisson)|très peur|vraiment peur|beaucoup de peur|davantage de (?:peur|frisson)|angoiss|stress intense/.test(wish);
  return {
    friendship: /amiti|ami\b|amie\b/.test(text),
    strongEmotion: /émotion|trag|pleur|trist|boulevers|touchant|touchée|touché/.test(text),
    tragicOpening: /trag/.test(wish),
    gentleFright,
    frightIntensity: strongerFright ? 'strong' : gentleFright ? 'gentle' : 'none',
    humor: /drôle|rigol|rire|farce/.test(text),
    mystery: /mystèr|énig|trésor/.test(text),
    musical: /musical|musique|chant|chanter/.test(text),
    bedtime: /calme|dormir|sommeil/.test(text),
    rescue: /sauvetage|sauver|secour|animaux/.test(text)
  };
}
