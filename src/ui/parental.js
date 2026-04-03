
import { getSettings, saveSettings } from '../storage/settings.js';
import { exportAllData } from '../storage/database.js';
import { setView } from '../core/engine.js';
import { renderHome } from './carousel.js';

export const setupParental = () => {
    // Remplir les champs avec les settings actuels
    const s = getSettings();
    document.getElementById('input-api-key').value = s.apiKey || '';
    document.getElementById('input-age').value = s.childAge || 5;
    document.getElementById('input-provider').value = s.provider || 'github';
    document.getElementById('input-model').value = s.modelName || 'gpt-4o-mini';

    // Gérer l'affichage du champ GitHub
    const providerSelect = document.getElementById('input-provider');
    const githubGroup = document.getElementById('github-settings-group');
    const toggleProviderFields = () => {
        githubGroup.style.display = providerSelect.value === 'github' ? 'block' : 'none';
    };
    providerSelect.addEventListener('change', toggleProviderFields);
    toggleProviderFields(); // init

    // Logique du bouton paramètre (Le Cadenas)
    document.getElementById('btn-settings').onclick = () => {
        const currentSettings = getSettings();

        if (!currentSettings.parentPin) {
            // Premier lancement : Définition du code
            const newPin = prompt("Bienvenue ! Définissez un code PIN à 4 chiffres pour protéger cet espace :");
            if (newPin && newPin.length >= 4) {
                currentSettings.parentPin = newPin;
                saveSettings(currentSettings);
                alert("Code PIN enregistré !");
                setView('view-settings');
            } else {
                alert("Code trop court, abandon.");
            }
        } else {
            // Lancement classique : Vérification
            const pin = prompt("Code Parent :");
            if (pin === currentSettings.parentPin) {
                setView('view-settings');
            } else {
                alert("Code incorrect !");
            }
        }
    };

    // Fermeture de la modale et sauvegarde
    document.querySelectorAll('.btn-close-view').forEach(b => {
        b.onclick = (e) => {
            const parentView = e.target.closest('.view');
            if (parentView && parentView.id === 'view-settings') {
                const newSettings = getSettings();
                newSettings.apiKey = document.getElementById('input-api-key').value;
                newSettings.childAge = parseInt(document.getElementById('input-age').value);
                newSettings.provider = document.getElementById('input-provider').value;
                newSettings.modelName = document.getElementById('input-model').value;
                saveSettings(newSettings);
            }
            renderHome();
            setView('view-home');
        };
    });

    // Export des données
    document.getElementById('btn-export').onclick = async () => {
        const data = await exportAllData();
        const blob = new Blob([JSON.stringify(data)], {type:'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'conteur_backup.json';
        a.click();
    };
};
