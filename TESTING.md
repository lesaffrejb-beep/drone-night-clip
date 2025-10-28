1. Depuis la racine du projet, lancer un serveur statique (`npx serve .` ou `python -m http.server 4173`).
2. Ouvrir l’URL locale et vérifier l’overlay : boutons Play & Preset 30s visibles, slider BPM actif.
3. Cliquer Play : l’overlay disparaît, la ville 3D se lance, aucun message d’erreur dans la console.
4. Balayer le slider BPM : le nombre #bpm-value suit et les pulses visuels (bloom/caméra) battent au nouveau tempo.
5. Cliquer Preset 30s (en local ou via GitHub Pages) : la scène Moonrun repart à t=0 avec le BPM synchronisé et l’UI reflète le preset.
