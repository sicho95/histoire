
export const filterChoices = (choices) => {
    if (!choices || choices.length === 0) return [];
    if (choices.length <= 4) return choices.sort(() => Math.random() - 0.5);

    const orig = choices.find(c => c.is_original);
    const rest = choices.filter(c => c !== orig).sort((a,b) => (b.play_count||0) - (a.play_count||0));
    const fav = rest.shift();
    const learned = rest.filter(c => c.is_learned);
    const inv = learned.length ? learned[Math.floor(Math.random()*learned.length)] : rest.shift();
    const others = rest.filter(c => c !== inv);
    const rand = others[Math.floor(Math.random()*others.length)];

    return [orig, fav, inv, rand].filter(Boolean).sort(() => Math.random() - 0.5);
};
