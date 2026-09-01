  /* ──────────────────────────────────────────────────────────
     Interpréteur simple de tâches naturelles → PowerShell
     Utilisé quand le LLM local n'est pas disponible.
  ────────────────────────────────────────────────────────── */
  function _buildFallbackPowerShell(prompt) {
    var p = prompt.toLowerCase();
    var cmds = [];
    var getDeskTop = "$desktop = [Environment]::GetFolderPath('Desktop')";
    var getDocs    = "$docs = [Environment]::GetFolderPath('MyDocuments')";

    // Créer un fichier texte
    var isCreate = p.includes('crée') || p.includes('creer') || p.includes('créer') || p.includes('create') || p.includes('génère') || p.includes('generer');
    var isFile   = p.includes('fichier') || p.includes('document') || p.includes('file') || p.includes('txt') || p.includes('texte');
    if (isCreate && isFile) {
      var onDesk = p.includes('bureau') || p.includes('desktop');
      var inDocs = p.includes('documents') || p.includes('mes doc');
      var nameM  = prompt.match(/(?:nomm[eé]|appel[eé]|named?)\s*["']?([A-Za-z0-9_\-\s\.]+)["']?/i);
      var fileName = nameM ? nameM[1].trim().replace(/\.txt$/i,'') + '.txt' : 'EVA_document.txt';
      var contentM = prompt.match(/(?:contenu|content|avec le texte)\s*[:]\s*(.+)/i);
      var content  = contentM ? contentM[1].trim() : ('Document créé par EVA\n' + new Date().toLocaleString('fr-FR'));

      var targetDir = onDesk ? '$desktop' : (inDocs ? '$docs' : '$desktop');
      if (onDesk) cmds.push(getDeskTop);
      else if (inDocs) cmds.push(getDocs);
      else {
        var pathM = prompt.match(/[A-Z]:\\[^\s"'\n]+/i);
        if (pathM) {
          targetDir = '"' + pathM[0] + '"';
          cmds.push('New-Item -Path ' + targetDir + ' -ItemType Directory -Force | Out-Null');
        } else {
          cmds.push(getDeskTop);
          targetDir = '$desktop';
        }
      }
      cmds.push('@"' + '\n' + content + '\n' + '"@ | Out-File -FilePath "' + targetDir.replace('$','$') + '\\' + fileName + '" -Encoding UTF8');
      cmds.push('Write-Output "Fichier créé : ' + targetDir + '\\' + fileName + '"');
    }
    // Ouvrir une application
    else if (p.includes('ouvrir') || p.includes('lancer') || p.includes('ouvre') || p.includes('lance') || p.includes('open') || p.includes('start')) {
      var appMap = { 'notepad': 'notepad.exe', 'bloc-notes': 'notepad.exe', 'calc': 'calc.exe',
                     'calculatrice': 'calc.exe', 'paint': 'mspaint.exe', 'explorateur': 'explorer.exe',
                     'chrome': 'chrome', 'firefox': 'firefox', 'edge': 'msedge' };
      for (var name in appMap) {
        if (p.includes(name)) { cmds.push('Start-Process "' + appMap[name] + '"'); break; }
      }
    }
    // Lister fichiers
    else if (p.includes('liste') || p.includes('list') || p.includes('affiche les fichiers') || p.includes('contenu du dossier')) {
      cmds.push(getDeskTop);
      cmds.push('Get-ChildItem $desktop | Format-Table Name,Length,LastWriteTime | Out-String');
    }
    // Info système
    else if (p.includes('info') || p.includes('sysinfo') || p.includes('système') || p.includes('spec')) {
      cmds.push('Get-ComputerInfo | Select-Object CsName,OsName,CsProcessors,CsTotalPhysicalMemory | Format-List | Out-String');
    }

    return cmds.length > 0 ? cmds.join('\n') : null;
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
      let history = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
      finalReport = '';

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
            steps.push({ text: '\u2713 ' + finalReport.substring(0, 80), ts: new Date().toISOString() });
            await cmdRef.update({ step: 'Terminé \u2713', steps, updatedAt: new Date() });
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

            history.push({ role: 'user', content: 'Résultat:\n' + cmdResult + '\n\nQue fais-tu ensuite ? ([CMD] ou [REPORT])' });
          } else {
            history.push({ role: 'user', content: 'Utilise obligatoirement [CMD] ou [REPORT].' });
          }
        } catch(e) {
          llmAvailable = false;
          break;
        }
      }

      if (finalReport) return { output: finalReport, steps };
    }

    // ── Fallback : interpréteur PowerShell direct ──
    const stepFb = 'Mode direct (LLM indisponible) — Analyse de la tâche...';
    steps.push({ text: stepFb, ts: new Date().toISOString() });
    await cmdRef.update({ step: stepFb, steps, updatedAt: new Date() });
    window.dispatchEvent(new CustomEvent('cw:step', { detail: { step: stepFb } }));

    const psCmd = _buildFallbackPowerShell(userPrompt);

    if (!psCmd) {
      return {
        error: 'LLM local non disponible et tâche trop complexe pour l\'exécution directe. ' +
               'Activez le LLM dans les paramètres CloudWorks ou reformulez plus simplement (ex: "crée un fichier test.txt sur mon bureau").',
        steps
      };
    }

    try {
      const stepExec = 'PowerShell: ' + psCmd.split('\n')[0].substring(0, 70);
      steps.push({ text: stepExec, ts: new Date().toISOString() });
      await cmdRef.update({ step: stepExec, steps, updatedAt: new Date() });
      window.dispatchEvent(new CustomEvent('cw:step', { detail: { step: stepExec } }));

      const res = await window.eva.system.exec(psCmd);
      const output = res.success
        ? (res.stdout || 'Tâche exécutée avec succès.')
        : (res.stderr || res.error || 'Erreur inconnue');

      const stepDone = res.success
        ? '\u2713 ' + output.substring(0, 100)
        : '\u2717 Erreur: ' + output.substring(0, 100);
      steps.push({ text: stepDone, ts: new Date().toISOString() });
      await cmdRef.update({ step: stepDone, steps, updatedAt: new Date() });
      window.dispatchEvent(new CustomEvent('cw:step', { detail: { step: stepDone } }));

      if (!res.success) return { error: output, steps };
      return { output: 'Résultat:\n' + output, steps };
    } catch(e) {
      return { error: 'Erreur exécution: ' + e.message, steps };
    }
  }
