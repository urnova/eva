const fs = require('fs');
let task = fs.readFileSync('C:/Users/zozoo/.gemini/antigravity/brain/ababa079-367a-4a6b-a1b5-9bb6d141af0b/task.md', 'utf8');
task = task.replace('- `[ ]` Faire un `git commit`', '- `[x]` Faire un `git commit`');
task = task.replace('- `[ ]` Pousser vers GitHub (`git push`).', '- `[x]` Pousser vers GitHub (`git push`).');
task = task.replace('- `[ ]` **4. Commit & Déploiement**', '- `[x]` **4. Commit & Déploiement**');
fs.writeFileSync('C:/Users/zozoo/.gemini/antigravity/brain/ababa079-367a-4a6b-a1b5-9bb6d141af0b/task.md', task, 'utf8');
