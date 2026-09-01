import sys
sys.stdout.reconfigure(encoding='utf-8')

# ════════════════════════════════════════
# 1. REVERT pc-agent.js → restore clean runAgenticLoop (sans fallback PowerShell)
# ════════════════════════════════════════
with open(r'eva-pc/web/js/features/pc-agent.js', 'r', encoding='utf-8', errors='replace') as f:
    pa = f.read()

# Remove _buildFallbackPowerShell + replace the new runAgenticLoop with the clean version
start = pa.find('  /* ────────────────────────────────────────────────────────────\n     Interpréteur simple')
if start < 0:
    start = pa.find('  /* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n     Interpréteur simple')
if start < 0:
    # Try other marker
    start = pa.find('  function _buildFallbackPowerShell')
end = pa.find('\n  // Démarrer dès que', start if start >= 0 else 0)

print(f'revert start={start}, end={end}')

CLEAN_LOOP = """  async function runAgenticLoop(userPrompt, cmdId, uid, cmdRef) {
    const systemPrompt = `Tu es l'Agent PC Autonome d'EVA. Ton rôle est d'accomplir des tâches sur le système Windows de l'utilisateur.
Tu as accès à un exécuteur de commandes PowerShell.
Pour exécuter une commande, renvoie EXACTEMENT ce bloc : [CMD] ta_commande_ici [/CMD]
Tu recevras ensuite le résultat de la commande.
Raisonne étape par étape. Enchaîne plusieurs commandes si nécessaire. Une fois la tâche ENTIÈREMENT terminée, renvoie : [REPORT] ton_rapport_final [/REPORT]
Sois concis et direct.`;

    let history = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    let finalReport = '';
    const steps = [];

    for (let i = 0; i < 15; i++) {
      try {
        // Notifier l'utilisateur de l'étape en cours
        const stepWait = i === 0 ? 'Démarrage du LLM local...' : 'Raisonnement en cours (' + i + ')...';
        await cmdRef.update({ step: stepWait, updatedAt: new Date() });
        window.dispatchEvent(new CustomEvent('cw:step', { detail: { step: stepWait } }));

        const data = await window.eva.system.llmChat(history);
        // Adapter format OpenAI → texte
        if (data.choices && data.choices[0] && data.choices[0].message) {
          data.message = data.choices[0].message;
        }
        const text = (data.message && data.message.content) ? data.message.content : '';
        if (!text) {
          history.push({ role: 'user', content: 'Utilise [CMD] ou [REPORT].' });
          continue;
        }
        history.push({ role: 'assistant', content: text });

        // Rapport final ?
        var reportMatch = text.match(/\\[REPORT\\]([\\s\\S]*?)\\[\\/REPORT\\]/i);
        if (reportMatch) {
          finalReport = reportMatch[1].trim();
          steps.push({ text: '\\u2713 ' + finalReport.substring(0, 100), ts: new Date().toISOString() });
          await cmdRef.update({ step: 'Terminé \\u2713', steps, updatedAt: new Date() });
          break;
        }

        // Commandes à exécuter ?
        var allCmds = [];
        var regex = /\\[CMD\\]([\\s\\S]*?)\\[\\/CMD\\]/gi;
        var m;
        while ((m = regex.exec(text)) !== null) allCmds.push(m[1].trim());

        if (allCmds.length > 0) {
          var results = [];
          for (var ci = 0; ci < allCmds.length; ci++) {
            var cmd = allCmds[ci];
            var stepText = 'Exécution [' + (ci+1) + '/' + allCmds.length + ']: ' + cmd.substring(0, 70) + (cmd.length > 70 ? '...' : '');
            steps.push({ text: stepText, ts: new Date().toISOString() });
            await cmdRef.update({ step: stepText, steps, updatedAt: new Date() });
            window.dispatchEvent(new CustomEvent('cw:step', { detail: { step: stepText } }));
            try {
              var res = await window.eva.system.exec(cmd);
              var out = res.success ? (res.stdout || '(succès, pas de sortie)') : ('ERREUR: ' + (res.stderr || res.error));
              results.push('$ ' + cmd + '\\n' + out);
            } catch(e) { results.push('$ ' + cmd + '\\nErreur: ' + e.message); }
          }
          history.push({ role: 'user', content: 'Résultats:\\n' + results.join('\\n---\\n') + '\\n\\nContinue ou termine avec [REPORT].' });
        } else {
          // Pas de [CMD] ni [REPORT] → forcer
          history.push({ role: 'user', content: 'Utilise [CMD] commande [/CMD] pour agir ou [REPORT] résumé [/REPORT] pour finir.' });
        }
      } catch(e) {
        var errMsg = e && e.message ? e.message : String(e);
        var stepErr = 'Erreur LLM: ' + errMsg.substring(0, 100);
        steps.push({ text: '\\u2717 ' + stepErr, ts: new Date().toISOString() });
        await cmdRef.update({ step: stepErr, steps, updatedAt: new Date() });
        return { error: errMsg, steps };
      }
    }
    if (!finalReport) finalReport = 'Tâche terminée (limite de 15 itérations atteinte).';
    return { output: finalReport, steps };
  }
"""

if start >= 0 and end >= 0:
    pa = pa[:start] + CLEAN_LOOP + '\n' + pa[end:]
    print('pc-agent.js: runAgenticLoop reverted to clean version')
else:
    # Fallback: just find and replace the current version
    start2 = pa.find('  async function runAgenticLoop')
    end2 = pa.find('\n  // Démarrer dès que', start2)
    if start2 >= 0 and end2 >= 0:
        pa = pa[:start2] + CLEAN_LOOP + '\n' + pa[end2:]
        print('pc-agent.js: runAgenticLoop replaced (fallback)')
    else:
        print('ERROR: cannot find runAgenticLoop boundaries')

with open(r'eva-pc/web/js/features/pc-agent.js', 'w', encoding='utf-8') as f:
    f.write(pa)
print('pc-agent.js saved')

# ════════════════════════════════════════
# 2. REVERT file-gen.js → remove run_script case (keep only agentic_task)
# ════════════════════════════════════════
with open(r'eva-pc/web/js/app/file-gen.js', 'r', encoding='utf-8', errors='replace') as f:
    fg = f.read()

# Remove the run_script block we added
RS_START = "    } else if (action.type === 'run_script') {\n      /* Commande PowerShell directe"
RS_END   = "    } else if (action.type === 'note') {"

if RS_START in fg:
    s = fg.find(RS_START)
    e = fg.find(RS_END)
    fg = fg[:s] + '    ' + fg[e:]
    print('file-gen.js: run_script block removed')
else:
    print('file-gen.js: run_script block not found (already clean)')

with open(r'eva-pc/web/js/app/file-gen.js', 'w', encoding='utf-8') as f:
    f.write(fg)
print('file-gen.js saved')

# ════════════════════════════════════════
# 3. REVERT messages.js → restore single agentic_task line
# ════════════════════════════════════════
with open(r'eva-pc/web/js/app/messages.js', 'r', encoding='utf-8', errors='replace') as f:
    msgs = f.read()

OLD_DOUBLE = "      '- Tâche PC simple (créer fichier, liste dossier, ouvrir app) → [ACTION:{\"type\":\"run_script\",\"command\":\"PowerShell: commande_ici\"}]\\n' +\n      '- Tâche PC complexe multi-étapes → [ACTION:{\"type\":\"agentic_task\",\"prompt\":\"Instructions complètes...\"}]\\n' +"
NEW_SINGLE = "      '- Tâche PC (créer fichier, dossier, renommer, rechercher, exécuter) → [ACTION:{\"type\":\"agentic_task\",\"prompt\":\"Instructions complètes et précises...\"}]\\n' +"

if OLD_DOUBLE in msgs:
    msgs = msgs.replace(OLD_DOUBLE, NEW_SINGLE, 1)
    print('messages.js: reverted to single agentic_task')
else:
    print('messages.js: double run_script+agentic not found')

with open(r'eva-pc/web/js/app/messages.js', 'w', encoding='utf-8') as f:
    f.write(msgs)
print('messages.js saved')
print()
print('All reverts done')
