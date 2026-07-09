const fs = require('fs');
let task = fs.readFileSync('C:/Users/zozoo/.gemini/antigravity/brain/ababa079-367a-4a6b-a1b5-9bb6d141af0b/task.md', 'utf8');

task = task.replace('- `[ ]` Mettre à jour `systemPrompt` dans `chat-handler.js`', '- `[x]` Mettre à jour `systemPrompt` dans `chat-handler.js`');
task = task.replace('- `[ ]` Vérifier la déclaration "Application PC"', '- `[x]` Vérifier la déclaration "Application PC"');
task = task.replace('- `[ ]` **4. Intelligence E.V.A (Prompt & Reconnaissance PC)**', '- `[x]` **4. Intelligence E.V.A (Prompt & Reconnaissance PC)**');

task = task.replace('- `[ ]` Implémenter un contexte/mémoire roulante temporaire', '- `[x]` Implémenter un contexte/mémoire roulante temporaire');
task = task.replace('- `[ ]` L\\'injecter lors de la génération du rapport', '- `[x]` L\\'injecter lors de la génération du rapport');
task = task.replace('- `[ ]` **5. Vision Réparation & Cerveau Temporaire**', '- `[x]` **5. Vision Réparation & Cerveau Temporaire**');

fs.writeFileSync('C:/Users/zozoo/.gemini/antigravity/brain/ababa079-367a-4a6b-a1b5-9bb6d141af0b/task.md', task, 'utf8');
