import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'eva-pc/web/js/features/pc-agent.js', 'r', encoding='utf-8', errors='replace') as f:
    pa = f.read()

# Replace runAgenticLoop with a smarter version that falls back to PowerShell
OLD_LOOP = """  async function runAgenticLoop(userPrompt, cmdId, uid, cmdRef) {
    const systemPrompt = `Tu es l'Agent PC Autonome d'EVA (modèle LLM local). Ton rôle est d'accomplir des tâches sur le système Windows de l'utilisateur.
Tu as accès à un exécuteur de commandes PowerShell. 
Pour exécuter une commande, renvoie EXACTEMENT ce bloc : [CMD] ta_commande_ici [/CMD]
Tu recevras ensuite le résultat de la commande.
Raisonne étape par étape. Une fois la tâche entièrement terminée, renvoie : [REPORT] ton_rapport_final [/REPORT]
Sois concis et direct. Pas de longs discours.`;

    let history = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    let finalReport = 'Tâche terminée sans rapport final.';
    const steps = [];

    for (let i = 0; i < 10; i++) {
      try {
        const data = await window.eva.system.llmChat(history);
        // Adapter format OpenAI → Ollama
        if (data.choices && data.choices[0] && data.choices[0].message) {
          data.message = data.choices[0].message;
        }
        const text = data.message?.content || '';
        history.push({ role: 'assistant', content: text });

        // Rapport final ?
        const reportMatch = text.match(/\\[REPORT\\]([\\s\\S]*?)\\[\\/REPORT\\]/i);
        if (reportMatch) {
          finalReport = reportMatch[1].trim();
          steps.push({ text: '✓ ' + finalReport.substring(0, 80), ts: new Date().toISOString() });
          await cmdRef.update({ step: 'Terminé ✓', steps, updatedAt: new Date() });
          break;
        }

        // Commande à exécuter ?
        const cmdMatch = text.match(/\\[CMD\\]([\\s\\S]*?)\\[\\/CMD\\]/i);
        if (cmdMatch) {
          const cmd = cmdMatch[1].trim();
          const stepText = 'Exécution: ' + cmd.substring(0, 70) + (cmd.length > 70 ? '...' : '');
          steps.push({ text: stepText, ts: new Date().toISOString() });
          await cmdRef.update({ step: stepText, steps, updatedAt: new Date() });
          window.dispatchEvent(new CustomEvent('cw:step', { detail: { step: stepText } }));

          let cmdResult = '';
          try {
            const res = await window.eva.system.exec(cmd);
            cmdResult = res.success ? (res.stdout || 'Succès') : (res.stderr || res.error);
          } catch(e) { cmdResult = 'Erreur: ' + e; }

          history.push({ role: 'user', content: 'Résultat:\\n' + cmdResult + '\\n\\nQue fais-tu ensuite ? ([CMD] ou [REPORT])' });
        } else {
          history.push({ role: 'user', content: 'Utilise obligatoirement [CMD] ou [REPORT].' });
        }
      } catch(e) {
        return { error: e.message, steps };
      }
    }
    return { output: finalReport, steps };
  }"""

NEW_LOOP = """  /* ──────────────────────────────────────────────────────────
     Interpréteur simple de tâches naturelles → PowerShell
     Utilisé quand le LLM local n'est pas disponible.
  ────────────────────────────────────────────────────────── */
  function _buildFallbackPowerShell(prompt) {
    const p = prompt.toLowerCase();
    const cmds = [];

    // Chemin bureau / dossiers communs
    const getDeskTop = "$desktop = [Environment]::GetFolderPath('Desktop')";
    const getDocs    = "$docs = [Environment]::GetFolderPath('MyDocuments')";

    // Créer un fichier texte sur le bureau
    if ((p.includes('créer') || p.includes('creer') || p.includes('créé') || p.includes('create')) &&
        (p.includes('fichier') || p.includes('document') || p.includes('file') || p.includes('txt'))) {
      const onDesk  = p.includes('bureau') || p.includes('desktop');
      const inDocs  = p.includes('documents') || p.includes('mes doc');
      const nameM   = prompt.match(/(?:nommé|appelé|named?|:)\s*["']?([A-Za-z0-9_\-\s\.]+)["']?/i);
      const fileName = nameM ? nameM[1].trim().replace(/\.txt$/i,'') + '.txt' : 'EVA_document.txt';
      const contentM = prompt.match(/(?:contenu|content|avec)\s*[:]\s*(.+)/i);
      const content  = contentM ? contentM[1].trim() : ('Document créé par EVA\\n' + new Date().toLocaleString('fr-FR'));

      if (onDesk) {
        cmds.push(getDeskTop);
        cmds.push(`"${content}" | Out-File -FilePath "$desktop\\\\${fileName}" -Encoding UTF8`);
        cmds.push(`Write-Output "Fichier créé : $desktop\\\\${fileName}"`);
      } else if (inDocs) {
        cmds.push(getDocs);
        cmds.push(`"${content}" | Out-File -FilePath "$docs\\\\${fileName}" -Encoding UTF8`);
        cmds.push(`Write-Output "Fichier créé : $docs\\\\${fileName}"`);
      } else {
        // Chemin mentionné explicitement dans le prompt ?
        const pathM = prompt.match(/[A-Z]:\\\\[^"\\n]+/i) || prompt.match(/["']([^"']+)["']/);
        if (pathM) {
          const dir = pathM[0].replace(/\\\\/g,'\\\\');
          cmds.push(`New-Item -Path "${dir}" -ItemType Directory -Force | Out-Null`);
          cmds.push(`"${content}" | Out-File -FilePath "${dir}\\\\${fileName}" -Encoding UTF8`);
          cmds.push(`Write-Output "Fichier créé : ${dir}\\\\${fileName}"`);
        } else {
          cmds.push(getDeskTop);
          cmds.push(`"${content}" | Out-File -FilePath "$desktop\\\\${fileName}" -Encoding UTF8`);
          cmds.push(`Write-Output "Fichier créé : $desktop\\\\${fileName}"`);
        }
      }
    }
    // Ouvrir une application
    else if (p.includes('ouvrir') || p.includes('lancer') || p.includes('open') || p.includes('start')) {
      const apps = { 'notepad': 'notepad.exe', 'bloc-notes': 'notepad.exe', 'calc': 'calc.exe', 'calculatrice': 'calc.exe',
                     'paint': 'mspaint.exe', 'explorateur': 'explorer.exe', 'chrome': 'chrome.exe', 'firefox': 'firefox.exe' };
      for (const [name, exe] of Object.entries(apps)) {
        if (p.includes(name)) { cmds.push(`Start-Process "${exe}"`); break; }
      }
    }
    // Capture d'écran
    else if (p.includes('screenshot') || p.includes('capture') || p.includes('écran')) {
      return null; // Handled by type=screenshot directly
    }
    // Lister les fichiers
    else if (p.includes('liste') || p.includes('list') || p.includes('affiche')) {
      const dirM = prompt.match(/(?:dans|in|de|of)\s+["']?([A-Z]:\\\\[^"'\\n]+|bureau|desktop|documents)["']?/i);
      if (dirM && (dirM[1].toLowerCase() === 'bureau' || dirM[1].toLowerCase() === 'desktop')) {
        cmds.push(getDeskTop);
        cmds.push('Get-ChildItem $desktop | Format-Table Name,Length,LastWriteTime | Out-String');
      } else {
        cmds.push('Get-ChildItem . | Format-Table Name,Length,LastWriteTime | Out-String');
      }
    }
    // Supprimer fichier
    else if (p.includes('supprimer') || p.includes('effacer') || p.includes('delete') || p.includes('remove')) {
      const fileM = prompt.match(/["']([^"']+)["']/);
      if (fileM) cmds.push(`Remove-Item "${fileM[1]}" -Force`);
    }

    return cmds.length > 0 ? cmds.join('\\n') : null;
  }

  async function runAgenticLoop(userPrompt, cmdId, uid, cmdRef) {
    const systemPrompt = `Tu es l'Agent PC Autonome d'EVA (modèle LLM local). Ton rôle est d'accomplir des tâches sur le système Windows de l'utilisateur.
Tu as accès à un exécuteur de commandes PowerShell.
Pour exécuter une commande, renvoie EXACTEMENT ce bloc : [CMD] ta_commande_ici [/CMD]
Tu recevras ensuite le résultat de la commande.
Raisonne étape par étape. Une fois la tâche entièrement terminée, renvoie : [REPORT] ton_rapport_final [/REPORT]
Sois concis et direct. Pas de longs discours.`;

    const steps = [];
    let finalReport = '';

    // ── Tentative avec le LLM local ──
    let llmAvailable = false;
    try {
      if (window.eva && window.eva.system && window.eva.system.llmStatus) {
        const s = await window.eva.system.llmStatus();
        llmAvailable = !!(s && s.running);
      }
    } catch(e) {}

    if (llmAvailable) {
      // LLM dispo → boucle agentique complète
      let history = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
      finalReport = 'Tâche terminée sans rapport final.';

      for (let i = 0; i < 10; i++) {
        try {
          const data = await window.eva.system.llmChat(history);
          if (data.choices && data.choices[0] && data.choices[0].message) {
            data.message = data.choices[0].message;
          }
          const text = data.message?.content || '';
          history.push({ role: 'assistant', content: text });

          const reportMatch = text.match(/\[REPORT\]([\s\S]*?)\[\/REPORT\]/i);
          if (reportMatch) {
            finalReport = reportMatch[1].trim();
            steps.push({ text: '✓ ' + finalReport.substring(0, 80), ts: new Date().toISOString() });
            await cmdRef.update({ step: 'Terminé ✓', steps, updatedAt: new Date() });
            break;
          }

          const cmdMatch = text.match(/\[CMD\]([\s\S]*?)\[\/CMD\]/i);
          if (cmdMatch) {
            const cmd = cmdMatch[1].trim();
            const stepText = 'Exécution: ' + cmd.substring(0, 70) + (cmd.length > 70 ? '...' : '');
            steps.push({ text: stepText, ts: new Date().toISOString() });
            await cmdRef.update({ step: stepText, steps, updatedAt: new Date() });
            window.dispatchEvent(new CustomEvent('cw:step', { detail: { step: stepText } }));

            let cmdResult = '';
            try {
              const res = await window.eva.system.exec(cmd);
              cmdResult = res.success ? (res.stdout || 'Succès') : (res.stderr || res.error);
            } catch(e) { cmdResult = 'Erreur: ' + e; }

            history.push({ role: 'user', content: 'Résultat:\\n' + cmdResult + '\\n\\nQue fais-tu ensuite ? ([CMD] ou [REPORT])' });
          } else {
            history.push({ role: 'user', content: 'Utilise obligatoirement [CMD] ou [REPORT].' });
          }
        } catch(e) {
          // LLM planté en cours → fallback
          llmAvailable = false;
          break;
        }
      }

      if (finalReport) return { output: finalReport, steps };
    }

    // ── Fallback : interpréteur PowerShell simple (pas de LLM) ──
    const stepFb = 'LLM indisponible — Exécution directe PowerShell...';
    steps.push({ text: stepFb, ts: new Date().toISOString() });
    await cmdRef.update({ step: stepFb, steps, updatedAt: new Date() });
    window.dispatchEvent(new CustomEvent('cw:step', { detail: { step: stepFb } }));

    const psCmd = _buildFallbackPowerShell(userPrompt);

    if (!psCmd) {
      return {
        error: 'LLM local non disponible et tâche trop complexe pour l\\'exécution directe. ' +
               'Activez le LLM dans les paramètres CloudWorks ou reformulez la tâche simplement.',
        steps
      };
    }

    try {
      const stepExec = 'Exécution PowerShell: ' + psCmd.split('\\n')[0].substring(0, 60) + '...';
      steps.push({ text: stepExec, ts: new Date().toISOString() });
      await cmdRef.update({ step: stepExec, steps, updatedAt: new Date() });
      window.dispatchEvent(new CustomEvent('cw:step', { detail: { step: stepExec } }));

      const res = await window.eva.system.exec(psCmd);
      const output = res.success ? (res.stdout || 'Tâche exécutée avec succès.') : (res.stderr || res.error || 'Erreur inconnue');

      const stepDone = res.success ? '✓ Terminé: ' + output.substring(0, 80) : '✗ Erreur: ' + output.substring(0, 80);
      steps.push({ text: stepDone, ts: new Date().toISOString() });
      await cmdRef.update({ step: stepDone, steps, updatedAt: new Date() });
      window.dispatchEvent(new CustomEvent('cw:step', { detail: { step: stepDone } }));

      if (!res.success) return { error: output, steps };
      return { output: 'Exécuté via PowerShell (fallback):\\n' + output, steps };
    } catch(e) {
      return { error: 'Erreur PowerShell: ' + e.message, steps };
    }
  }"""

if 'async function runAgenticLoop' in pa:
    # Find start and end of function
    start = pa.find('  async function runAgenticLoop')
    # Find next function definition after it
    end = pa.find('\n\n  // Démarrer dès que l\\'utilisateur est authentifié', start)
    if end < 0:
        end = pa.find('\n\n  // Exposer', start)
    if end >= 0:
        pa = pa[:start] + NEW_LOOP + '\n' + pa[end:]
        print('FIX 2: runAgenticLoop replaced with smart fallback version')
    else:
        print('WARN FIX 2: end of runAgenticLoop not found')
else:
    print('WARN FIX 2: runAgenticLoop not found')

with open(r'eva-pc/web/js/features/pc-agent.js', 'w', encoding='utf-8') as f:
    f.write(pa)
print('pc-agent.js saved')
