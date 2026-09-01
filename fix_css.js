const fs = require('fs');
['f:/code/eva/evaprojectmultiplatforme/EVA_V4_fixed_v4/assets/styles/chat.css', 'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/assets/styles/chat.css'].forEach(p => { 
  let c = fs.readFileSync(p, 'utf8'); 
  let fixed = c.replace(/\/\*CloudWorksTrackerinChat\*\/[\s\S]*/, `/* CloudWorks Tracker in Chat */
.cw-tracker-bubble { border: 1px solid rgba(168,85,247,0.3); background: rgba(168,85,247,0.05); flex-direction: column; padding: 12px; gap: 8px; border-radius: 12px; }
.cw-tracker-header { font-size: 0.9em; font-weight: bold; color: #a855f7; display: flex; align-items: center; gap: 6px; }
.cw-tracker-prompt { font-size: 0.85em; color: var(--text-muted); font-style: italic; border-left: 2px solid rgba(168,85,247,0.4); padding-left: 8px; margin: 4px 0; }
.cw-tracker-step { font-size: 0.85em; color: var(--text); font-family: 'Space Mono', monospace; display: flex; align-items: center; gap: 6px; }
.cw-tracker-actions { display: flex; gap: 8px; margin-top: 6px; }
.cw-tracker-cancel { background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); border-radius: 6px; padding: 5px 12px; font-size: 0.8em; cursor: pointer; transition: all 0.2s; }
`);
  fs.writeFileSync(p, fixed, 'utf8'); 
});
