const fs = require('fs');
let task = fs.readFileSync('C:/Users/zozoo/.gemini/antigravity/brain/ababa079-367a-4a6b-a1b5-9bb6d141af0b/task.md', 'utf8');
task = task.replace('- `[ ]` Modifier `auth.js` pour enregistrer les sessions', '- `[x]` Modifier `auth.js` pour enregistrer les sessions');
task = task.replace('- `[ ]` Ajouter un écouteur local pour forcer la déconnexion', '- `[x]` Ajouter un écouteur local pour forcer la déconnexion');
task = task.replace('- `[ ]` Modifier `settings-panel.js` pour afficher la liste des sessions', '- `[x]` Modifier `settings-panel.js` pour afficher la liste des sessions');
task = task.replace('- `[ ]` **1. Gestion des Sessions (Web & PC)**', '- `[x]` **1. Gestion des Sessions (Web & PC)**');
fs.writeFileSync('C:/Users/zozoo/.gemini/antigravity/brain/ababa079-367a-4a6b-a1b5-9bb6d141af0b/task.md', task, 'utf8');
