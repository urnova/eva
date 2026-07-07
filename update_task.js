const fs = require('fs');
let task = fs.readFileSync('C:/Users/zozoo/.gemini/antigravity/brain/ababa079-367a-4a6b-a1b5-9bb6d141af0b/task.md', 'utf8');
task = task.replace('- `[ ]` Remplacer la section "Téléchargement" dans `index.html` pour ne montrer que la version Desktop.', '- `[x]` Remplacer la section "Téléchargement" dans `index.html` pour ne montrer que la version Desktop.');
task = task.replace('- `[ ]` Supprimer la carte "EVA MOBILE" dans `download.html`.', '- `[x]` Supprimer la carte "EVA MOBILE" dans `download.html`.');
task = task.replace('- `[ ]` **1. Nettoyage du site Web', '- `[x]` **1. Nettoyage du site Web');
fs.writeFileSync('C:/Users/zozoo/.gemini/antigravity/brain/ababa079-367a-4a6b-a1b5-9bb6d141af0b/task.md', task, 'utf8');
