const fs = require('fs');
let task = fs.readFileSync('C:/Users/zozoo/.gemini/antigravity/brain/ababa079-367a-4a6b-a1b5-9bb6d141af0b/task.md', 'utf8');

task = task.replace('- `[ ]` Modifier le CSS', '- `[x]` Modifier le CSS');
task = task.replace('- `[ ]` **6. Correctif UI Chat PC**', '- `[x]` **6. Correctif UI Chat PC**');

task = task.replace('- `[ ]` Mettre à jour `overlay.html`', '- `[x]` Mettre à jour `overlay.html`');
task = task.replace('- `[ ]` Adapter les états envoyés par `pc-agent.js`', '- `[x]` Adapter les états envoyés par `pc-agent.js`');
task = task.replace('- `[ ]` **7. Redesign de l\\'Overlay (Pilule & Animations)**', '- `[x]` **7. Redesign de l\\'Overlay (Pilule & Animations)**');

fs.writeFileSync('C:/Users/zozoo/.gemini/antigravity/brain/ababa079-367a-4a6b-a1b5-9bb6d141af0b/task.md', task, 'utf8');
