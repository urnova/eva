const fs = require('fs');
let task = fs.readFileSync('C:/Users/zozoo/.gemini/antigravity/brain/ababa079-367a-4a6b-a1b5-9bb6d141af0b/task.md', 'utf8');

task = task.replace('- `[ ]` Réparer les commandes dans `pc-agent.js`', '- `[x]` Réparer les commandes dans `pc-agent.js`');
task = task.replace('- `[ ]` Ajouter les options par défaut dans `cloudworks.js`', '- `[x]` Ajouter les options par défaut dans `cloudworks.js`');
task = task.replace('- `[ ]` Vérifier le Dashboard CloudWorks spécifique PC', '- `[x]` Vérifier le Dashboard CloudWorks spécifique PC');
task = task.replace('- `[ ]` **2. Refonte & Réparation de CloudWorks (PC)**', '- `[x]` **2. Refonte & Réparation de CloudWorks (PC)**');

task = task.replace('- `[ ]` Intégrer un mécanisme d\\'exécution LLM local', '- `[x]` Intégrer un mécanisme d\\'exécution LLM local');
task = task.replace('- `[ ]` Intercepter les commandes distantes agentiques', '- `[x]` Intercepter les commandes distantes agentiques');
task = task.replace('- `[ ]` **3. Modèle Local LLM Agentique (PC)**', '- `[x]` **3. Modèle Local LLM Agentique (PC)**');

fs.writeFileSync('C:/Users/zozoo/.gemini/antigravity/brain/ababa079-367a-4a6b-a1b5-9bb6d141af0b/task.md', task, 'utf8');
