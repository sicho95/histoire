export const FRENCH_SPEECH_VERSION = 'fr-pronunciation-v1';

const FRENCH_ONOMATOPOEIA = new Map([
  ['plouf', 'plouffe'], ['pouf', 'pouffe'], ['boum', 'boume'], ['ploc', 'ploque'],
  ['plim', 'plime'], ['plam', 'plame'], ['plop', 'plope'], ['pop', 'pope'],
  ['ding', 'dingue'], ['toc', 'toque'], ['clac', 'claque'], ['cric', 'crique'],
  ['hic', 'hique'], ['snif', 'sniffe'], ['tin', 'tine'], ['vroum', 'vroume'],
  ['pouet', 'pouète'], ['bou', 'bouh'], ['frou-frou', 'frou frou'], ['hou-hou', 'hou hou'],
  ['fi-ou', 'fi ou'], ['prout-prout', 'proute proute'], ['fiiiiou', 'fiii ou'],
  ['iiiiik', 'iiiiique'], ['frouuu', 'frou-ou']
]);

const ONOMATOPOEIA_PATTERN = new RegExp(`\\b(${[...FRENCH_ONOMATOPOEIA.keys()].join('|')})\\b`, 'giu');

export function forceFrenchPronunciation(text) {
  return String(text || '').replace(ONOMATOPOEIA_PATTERN, match => FRENCH_ONOMATOPOEIA.get(match.toLocaleLowerCase('fr')) || match);
}
