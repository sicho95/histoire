
const KEY = 'conteur_settings';
const DEFAULT = {
    apiKey: "",
    childAge: 5,
    parentPin: null, // Null signifie "non configuré au premier lancement"
    provider: "github",
    modelName: "gpt-4o-mini"
};

export const getSettings = () => {
    try {
        return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch(e) {
        return DEFAULT;
    }
};

export const saveSettings = (s) => localStorage.setItem(KEY, JSON.stringify(s));
