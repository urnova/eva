import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'eva-pc/web/js/features/pc-agent.js', 'r', encoding='utf-8', errors='replace') as f:
    pa = f.read()

# Find and replace runAgenticLoop
start = pa.find('  async function runAgenticLoop')
end = pa.find('\n  // Démarrer dès que', start)
print(f'runAgenticLoop: start={start}, end={end}')

NEW_LOOP = r"""  async function runAgenticLoop(userPrompt, cmdId, uid, cmdRef) {
    const systemPrompt = `Tu es l'Agent PC Autonome d'EVA. Tu opères directement sur Windows via PowerShell.
CAPACITÉS COMPLÈTES :
- Créer/lire/modifier/déplacer/renommer/supprimer des fichiers et dossiers
- Ouvrir des applications (notepad, chrome, explorer, calc, vscode, etc.)
- Naviguer sur le web (ouvrir un navigateur sur une URL précise)
- Rechercher des informations sur internet via Start-Process
- Récupérer des informations système
- Gérer des processus Windows

SÉCURITÉ : Avant de supprimer un fichier important (Documents, Bureau, fichier non-temporaire), demande confirmation avec [CONFIRM] description_action [/CONFIRM]. Attends la réponse avant d'agir.

RÈGLES D'EXÉCUTION :
- Pour exécuter une commande PowerShell : [CMD] commande_ici [/CMD]
- Pour ouvrir une URL dans le navigateur : [CMD] Start-Process "https://..." [/CMD]
- Pour ouvrir une appli : [CMD] Start-Process "nom_appli.exe" [/CMD]
- Tu recevras le résultat de chaque commande
- Enchaîne autant de commandes que nécessaire — pas de limite
- Une fois TOUT terminé : [REPORT] résumé_complet [/REPORT]
- Sois concis, efficace, professionnel`;

    const history = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    const steps = [];
    let finalReport = '';
    let iteration = 0;

    // Vérifier si LLM déjà actif pour le message initial
    let llmWasRunning = false;
    try {
      const s = await window.eva.system.llmStatus();
      llmWasRunning = !!(s && s.running);
    } catch(e) {}

    const firstStep = llmWasRunning
      ? 'LLM actif — Analyse de la tâche...'
      : 'Démarrage du LLM local...';
    steps.push({ text: firstStep, ts: new Date().toISOString() });
    await cmdRef.update({ step: firstStep, steps, updatedAt: new Date() });
    window.dispatchEvent(new CustomEvent('cw:step', { detail: { step: firstStep } }));

    // Boucle infinie — seul [REPORT] ou une erreur l'arrête
    while (true) {
      iteration++;
      try {
        const raisonnement = iteration > 1 ? `Raisonnement étape ${iteration}...` : firstStep;
        if (iteration > 1) {
          await cmdRef.update({ step: raisonnement, updatedAt: new Date() });
          window.dispatchEvent(new CustomEvent('cw:step', { detail: { step: raisonnement } }));
        }

        const data = await window.eva.system.llmChat(history);
        if (data.choices && data.choices[0] && data.choices[0].message) {
          data.message = data.choices[0].message;
        }
        const text = (data.message && data.message.content) ? data.message.content : '';
        if (!text) { history.push({ role: 'user', content: 'Utilise [CMD] ou [REPORT].' }); continue; }
        history.push({ role: 'assistant', content: text });

        // Rapport final ?
        var reportMatch = text.match(/\[REPORT\]([\s\S]*?)\[\/REPORT\]/i);
        if (reportMatch) {
          finalReport = reportMatch[1].trim();
          steps.push({ text: '\u2713 ' + finalReport.substring(0, 120), ts: new Date().toISOString() });
          await cmdRef.update({ step: 'Termin\u00e9 \u2713', steps, updatedAt: new Date() });
          break;
        }

        // Demande de confirmation (fichiers sensibles)
        var confirmMatch = text.match(/\[CONFIRM\]([\s\S]*?)\[\/CONFIRM\]/i);
        if (confirmMatch) {
          var confirmText = confirmMatch[1].trim();
          var stepConf = '\u26a0\ufe0f Confirmation requise: ' + confirmText.substring(0, 80);
          steps.push({ text: stepConf, ts: new Date().toISOString() });
          await cmdRef.update({ step: stepConf, steps, updatedAt: new Date() });
          window.dispatchEvent(new CustomEvent('cw:step', { detail: { step: stepConf } }));
          // Demander confirmation à l'utilisateur
          var confirmed = await _askConfirmation(confirmText, cmdRef);
          history.push({ role: 'user', content: confirmed ? 'Oui, confirmé. Continue.' : 'Non, annulé. Ne supprime pas ce fichier.' });
          continue;
        }

        // Commandes à exécuter (plusieurs possibles)
        var allCmds = [];
        var cmdRegex = /\[CMD\]([\s\S]*?)\[\/CMD\]/gi;
        var m;
        while ((m = cmdRegex.exec(text)) !== null) allCmds.push(m[1].trim());

        if (allCmds.length > 0) {
          var results = [];
          for (var ci = 0; ci < allCmds.length; ci++) {
            var cmd = allCmds[ci];
            var stepText = 'Ex\u00e9cution [' + (ci+1) + '/' + allCmds.length + ']: ' + cmd.substring(0, 80) + (cmd.length > 80 ? '...' : '');
            steps.push({ text: stepText, ts: new Date().toISOString() });
            await cmdRef.update({ step: stepText, steps, updatedAt: new Date() });
            window.dispatchEvent(new CustomEvent('cw:step', { detail: { step: stepText } }));
            try {
              var res = await window.eva.system.exec(cmd);
              var out = res.success
                ? (res.stdout ? res.stdout.substring(0, 500) : '(succ\u00e8s, pas de sortie)')
                : ('ERREUR: ' + (res.stderr || res.error || 'Inconnue').substring(0, 300));
              var stepResult = (res.success ? '\u2713 ' : '\u2717 ') + cmd.substring(0, 40) + ': ' + out.substring(0, 60);
              steps.push({ text: stepResult, ts: new Date().toISOString() });
              await cmdRef.update({ step: stepResult, steps, updatedAt: new Date() });
              results.push('$ ' + cmd + '\n' + out);
            } catch(e) {
              results.push('$ ' + cmd + '\nErreur: ' + e.message);
            }
          }
          history.push({ role: 'user', content: 'R\u00e9sultats des commandes:\n' + results.join('\n---\n') + '\n\nContinue ou termine avec [REPORT].' });
        } else {
          history.push({ role: 'user', content: 'Utilise [CMD] commande [/CMD] pour agir, ou [REPORT] r\u00e9sum\u00e9 [/REPORT] pour finir.' });
        }
      } catch(e) {
        var errMsg = e && e.message ? e.message : String(e);
        var stepErr = '\u2717 Erreur: ' + errMsg.substring(0, 120);
        steps.push({ text: stepErr, ts: new Date().toISOString() });
        await cmdRef.update({ step: stepErr, steps, updatedAt: new Date() });
        return { error: errMsg, steps };
      }
    }

    if (!finalReport) finalReport = 'T\u00e2che termin\u00e9e.';
    return { output: finalReport, steps };
  }

  // Demande de confirmation utilisateur pour actions sensibles
  async function _askConfirmation(message, cmdRef) {
    return new Promise(function(resolve) {
      // Dispatcher un event pour que l'UI affiche une modale de confirmation
      var evt = new CustomEvent('cw:confirm-request', {
        detail: {
          message: message,
          onConfirm: function() { resolve(true); },
          onCancel: function() { resolve(false); }
        }
      });
      window.dispatchEvent(evt);
      // Timeout de sécurité 60s → auto-annuler si pas de réponse
      setTimeout(function() { resolve(false); }, 60000);
    });
  }
"""

if start >= 0 and end >= 0:
    pa = pa[:start] + NEW_LOOP + '\n' + pa[end:]
    print('FIX 3: runAgenticLoop replaced: no limit, full capabilities, smart first step, confirmation')
else:
    print('ERROR: cannot replace runAgenticLoop')

with open(r'eva-pc/web/js/features/pc-agent.js', 'w', encoding='utf-8') as f:
    f.write(pa)
print('pc-agent.js saved')
