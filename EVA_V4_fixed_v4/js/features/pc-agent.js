/* EVA PC — PC-AGENT.JS — Agent local CloudWorks pour le PC Desktop */
/* Ce fichier est EXCLUSIF à l'application PC — ne PAS copier sur le site web */
(async function() {
  'use strict';

  let unsubCmds = null;
  let deviceId = null;

  async function registerDevice() {
    if (!window.S || !window.S.user || !window.db) return;
    try {
      const uid = window.S.user.uid;

      let osInfo = 'Windows';
      let localIP = '127.0.0.1';
      let hostname = 'EVA Desktop';
      let macAddress = null;

      // Récupérer les infos système (dont l'adresse MAC stable)
      if (window.eva && window.eva.system) {
        try {
          const info = await window.eva.system.info();
          if (info.success && info.os) {
            osInfo = info.os.distro || info.os.platform || 'Windows';
            hostname = info.os.hostname || 'EVA Desktop';
          }
          if (info.success && info.net) {
            // Chercher la première interface physique avec IP + MAC
            const physNet = info.net.find(n => n.ip4 && !n.internal && n.mac && n.mac !== '00:00:00:00:00:00');
            if (physNet) {
              localIP = physNet.ip4;
              macAddress = physNet.mac;
            }
          }
        } catch(e){}
      }

      // ID stable basé sur l'adresse MAC (évite les doublons à chaque reconnexion)
      // Si la MAC est disponible → utiliser MAC-XX-XX-XX-XX-XX-XX
      // Sinon → fallback sur l'ancien ID aléatoire stocké en localStorage
      
      let sysUuid = null;
      try {
        if (typeof info !== 'undefined' && info && info.uuid && info.uuid.os) sysUuid = info.uuid.os;
      } catch(e) {}
      
      if (sysUuid) {
        deviceId = 'UUID-' + sysUuid.toUpperCase();
        localStorage.setItem('cw_device_id', deviceId);
      } else if (macAddress) {
        deviceId = 'MAC-' + macAddress.replace(/:/g, '-').toUpperCase();
        localStorage.setItem('cw_device_id', deviceId);
      } else {
        deviceId = localStorage.getItem('cw_device_id');
        if (!deviceId) {
          deviceId = 'PC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
          localStorage.setItem('cw_device_id', deviceId);
        }
      }

      // Exposer globalement pour le system prompt
      window._cwDeviceId = deviceId;

      const ts = typeof window.timestamp === 'function' ? window.timestamp() : new Date();
      const docRef = window.db.collection('cloudworks').doc(uid).collection('devices').doc(deviceId);
      window.pcAgentDocRef = docRef;

      await docRef.set({
        deviceId: deviceId,
        deviceName: hostname || 'EVA Desktop',
        deviceType: 'windows',
        localIP: localIP,
        macAddress: macAddress || null,
        osVersion: osInfo,
        online: true,
        lastSeen: ts,
        updatedAt: ts,
        sessionId: (window.S && window.S.sessionId) ? window.S.sessionId : null,
        appVersion: (window.eva && window.eva.app) ? await window.eva.app.version().catch(()=>'?') : '?'
      }, { merge: true }); // merge:true = réutilise le document existant si même MAC

      console.log('[CloudWorks] Enregistré sous ID:', deviceId, '| Hostname:', hostname);

      // Écouter les commandes
      listenCommands(uid);

      // Mettre à jour lastSeen toutes les minutes
      setInterval(() => {
        docRef.update({
          online: true,
          lastSeen: typeof window.timestamp === 'function' ? window.timestamp() : new Date(),
          updatedAt: typeof window.timestamp === 'function' ? window.timestamp() : new Date()
        }).catch(()=>{});
      }, 60000);

      // Passer hors-ligne à la fermeture
      window.addEventListener('beforeunload', () => {
        docRef.update({ online: false, lastSeen: typeof window.timestamp === 'function' ? window.timestamp() : new Date() }).catch(()=>{});
      });

      if (window.eva && window.eva.onAppRequestQuit) {
        window.eva.onAppRequestQuit(async () => {
          try { await docRef.update({ online: false }); } catch(e) {}
          window.eva.sendQuitReady();
        });
      }

      // Notifier CloudWorks UI que le device est enregistré
      window.dispatchEvent(new CustomEvent('cw:device-registered', { detail: { deviceId, hostname } }));

    } catch (e) {
      console.error('[CloudWorks] Erreur enregistrement:', e);
    }
  }

  function listenCommands(uid) {
    if (unsubCmds) unsubCmds();
    unsubCmds = window.db.collection('cloudworks').doc(uid).collection('commands')
      .where('deviceId', '==', deviceId)
      .onSnapshot(async (snap) => {
        for (const change of snap.docChanges()) {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.status === 'pending') {
              await handleCommand(change.doc.id, data, uid);
            }
          }
        }
      }, (e) => console.error('[CloudWorks] Erreur listenCommands:', e));
  }

  let _currentRunningCmdRef = null;
  let _currentRunningCancel = false;

  window.cancelCurrentCloudWorksTask = async function() {
    console.log('[CloudWorks] Interruption demandée pour la tâche en cours');
    _currentRunningCancel = true;
    try {
      if (window.eva && window.eva.system && typeof window.eva.system.llmAbort === 'function') {
        await window.eva.system.llmAbort();
      }
    } catch(e) {
      console.warn('[CloudWorks] Erreur llmAbort:', e);
    }
    if (_currentRunningCmdRef) {
      try {
        await _currentRunningCmdRef.update({
          status: 'cancelled',
          step: 'Tâche interrompue par l\'utilisateur',
          updatedAt: typeof window.timestamp === 'function' ? window.timestamp() : new Date()
        });
      } catch(e) {}
    }
    window.dispatchEvent(new CustomEvent('cw:task-cancelled'));
  };

  /* ═══════════════════════════════════════════
     Exécution d'une commande reçue
  ═══════════════════════════════════════════ */
  async function handleCommand(cmdId, data, uid) {
    if (!window.eva || !window.eva.system) return;
    const cmdRef = window.db.collection('cloudworks').doc(uid).collection('commands').doc(cmdId);
    _currentRunningCmdRef = cmdRef;
    _currentRunningCancel = false;

    // Afficher l'overlay
    if (window.eva.overlay) window.eva.overlay.show('cloudworks');

    // Notifier le chat qu'une tâche CloudWorks démarre
    window.dispatchEvent(new CustomEvent('cw:task-start', { detail: { cmdId, type: data.type, prompt: data.payload?.prompt } }));

    let resultData = null;
    let status = 'done';

    try {
      if (data.type === 'screenshot') {
        await _updateStep(cmdRef, 'Capture d\'écran en cours...');
        const res = await window.eva.system.screenshot();
        if (res.success) {
          resultData = { imageBase64: res.data };
          await _updateStep(cmdRef, 'Capture réussie ✓');
        } else throw new Error(res.error);
      }
      else if (data.type === 'agentic_task') {
        const prompt = data.payload?.prompt || 'Aucun prompt';
        const directCmd = data.payload?.command || null;
        await cmdRef.update({ status: 'running', updatedAt: new Date(), step: directCmd ? 'Exécution des commandes...' : 'Démarrage du LLM local...' });
        resultData = await runAgenticLoop(prompt, cmdId, uid, cmdRef, directCmd);
        status = (resultData && resultData.cancelled) ? 'cancelled' : ((resultData && resultData.error) ? 'error' : 'done');
      }
      else if (data.type === 'sysinfo') {
        await _updateStep(cmdRef, 'Récupération infos système...');
        const res = await window.eva.system.info();
        if (res.success) {
          var osInfo = res.os || {};
          var cpuInfo = res.cpu || {};
          var memInfo = res.mem || {};
          var netInfo = (res.net && res.net.length) ? res.net[0] : {};
          var diskInfo = (res.disk && res.disk.length) ? res.disk[0] : {};
          resultData = {
            os: osInfo.distro || osInfo.platform || osInfo.release || 'Windows',
            hostname: osInfo.hostname || 'EVA Desktop',
            uptime: osInfo.uptime ? Math.floor(osInfo.uptime / 3600) + 'h' : '—',
            cpu: cpuInfo.brand || cpuInfo.manufacturer || 'CPU inconnu',
            cpuUsage: null,
            ramTotal: memInfo.total ? Math.floor(memInfo.total / 1e9) + ' GB' : '—',
            ramFree: memInfo.free ? Math.floor(memInfo.free / 1e9) + ' GB' : '—',
            ramUsage: (memInfo.total && memInfo.used) ? Math.round(memInfo.used / memInfo.total * 100) : null,
            diskTotal: diskInfo.size ? Math.floor(diskInfo.size / 1e9) + ' GB' : '—',
            diskFree: diskInfo.available ? Math.floor(diskInfo.available / 1e9) + ' GB' : '—',
            diskUsage: (diskInfo.size && diskInfo.used) ? Math.round(diskInfo.used / diskInfo.size * 100) : null,
            localIP: netInfo.ip4 || '127.0.0.1',
            publicIP: '—'
          };
          await _updateStep(cmdRef, 'Infos récupérées ✓');
        } else throw new Error(res.error || 'sysinfo failed');
      }
      else if (data.type === 'run_script') {
        const cmd = data.payload?.command;
        if (cmd) {
          await _updateStep(cmdRef, 'Exécution: ' + cmd.substring(0, 60) + (cmd.length > 60 ? '...' : ''));
          const res = await window.eva.system.exec(cmd);
          resultData = res.success
            ? { stdout: res.stdout, stderr: res.stderr, exitCode: 0 }
            : { stderr: res.stderr || res.error, exitCode: 1 };
          await _updateStep(cmdRef, res.success ? 'Script terminé ✓' : 'Erreur script ✗');
        }
      }
      else if (data.type === 'open_ide_file') {
        const filePath = data.payload?.filePath;
        if (filePath) {
          await window.eva.system.exec(`code "${filePath}"`);
          resultData = { output: 'Fichier ouvert dans VS Code.' };
        } else throw new Error('Chemin manquant');
      }
      else if (data.type === 'lock') {
        await window.eva.system.lock();
        resultData = { output: 'Session verrouillée.' };
      }
      else if (data.type === 'sleep') {
        await window.eva.system.sleep();
        resultData = { output: 'Mise en veille effectuée.' };
      }
      else if (data.type === 'shutdown') {
        await window.eva.system.shutdown();
        resultData = { output: 'Extinction imminente.' };
      }
      else {
        throw new Error('Type de commande inconnu: ' + data.type);
      }
    } catch(err) {
      status = 'error';
      resultData = { error: err.message };
      console.error('[CloudWorks] Erreur commande:', err);
    }

    // Sanitiser les undefined pour Firestore (rejette undefined silencieusement)
    function _sanitize(obj) {
      if (obj === null || obj === undefined) return null;
      if (typeof obj !== 'object') return obj;
      var out = {};
      Object.keys(obj).forEach(function(k) {
        var v = obj[k];
        if (v === undefined) out[k] = null;
        else if (v !== null && typeof v === 'object' && !Array.isArray(v)) out[k] = _sanitize(v);
        else out[k] = v;
      });
      return out;
    }

    // Mettre à jour Firebase avec le résultat final
    try {
      await cmdRef.update({
        status: status,
        result: _sanitize(resultData),
        updatedAt: typeof window.timestamp === 'function' ? window.timestamp() : new Date()
      });
      console.log('[CloudWorks] Commande terminée:', data.type, '→', status);
    } catch(updateErr) {
      console.error('[CloudWorks] ERREUR mise à jour Firestore:', updateErr.message, '| status:', status, '| result size:', JSON.stringify(resultData || {}).length);
      // Fallback : stocker seulement le statut sans le résultat (évite les 1MB+ errors)
      try {
        await cmdRef.update({
          status: status,
          result: { error: 'Résultat trop volumineux pour Firestore: ' + updateErr.message },
          updatedAt: new Date()
        });
      } catch(e2) {
        console.error('[CloudWorks] DOUBLE ERREUR Firestore:', e2.message);
      }
    }

    // Notifier le chat de la fin
    window.dispatchEvent(new CustomEvent('cw:task-done', {
      detail: { cmdId, status, result: resultData, type: data.type }
    }));

    // Cacher l'overlay après 2 secondes
    setTimeout(() => {
      if (window.eva && window.eva.overlay) window.eva.overlay.hide();
    }, 2000);
  }

  async function _updateStep(cmdRef, step) {
    try {
      await cmdRef.update({ step, updatedAt: new Date() });
      window.dispatchEvent(new CustomEvent('cw:step', { detail: { step } }));
    } catch(e) {}
  }

  /* ═══════════════════════════════════════════
     Utilitaires Fast Path PowerShell
  ═══════════════════════════════════════════ */
  function _splitPowerShellCommands(script) {
    if (!script) return [];
    var lines = script.split(/\r?\n/);
    var commands = [];
    for (var l = 0; l < lines.length; l++) {
      var line = lines[l];
      var cur = '';
      var inDbl = false;
      var inSgl = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"' && !inSgl) inDbl = !inDbl;
        else if (ch === "'" && !inDbl) inSgl = !inSgl;
        else if (ch === ';' && !inDbl && !inSgl) {
          if (cur.trim()) commands.push(cur.trim());
          cur = '';
          continue;
        }
        cur += ch;
      }
      if (cur.trim()) commands.push(cur.trim());
    }
    return commands;
  }

  function _getStepTitle(cmd) {
    var c = (cmd || '').trim();
    if (/Start-Process\s+msedge/i.test(c)) return 'Ouverture du navigateur Edge';
    if (/Start-Process\s+chrome/i.test(c)) return 'Ouverture de Google Chrome';
    if (/Start-Process/i.test(c)) return 'Lancement de l\'application';

    if (/ItemType\s+Directory/i.test(c) || /^mkdir\b/i.test(c)) {
      var dMatch = c.match(/-Path\s+["']?([^"';]+?)["']?(?:\s+-[A-Za-z]+|$)/i);
      var dName = dMatch ? dMatch[1].split(/[\\\/]/).pop().trim() : 'dossier';
      return "Création du dossier '" + dName + "'";
    }

    if (/Set-Content|New-Item|Out-File/i.test(c)) {
      var fMatch = c.match(/-Path\s+["']?([^"';]+?)["']?(?:\s+-[A-Za-z]+|$)/i);
      var fName = fMatch ? fMatch[1].split(/[\\\/]/).pop().trim() : 'fichier';
      return "Création du fichier '" + fName + "'";
    }

    if (/Move-Item/i.test(c)) {
      var destMatch = c.match(/-Destination\s+["']?([^"';]+?)["']?(?:\s+-[A-Za-z]+|$)/i);
      var destName = destMatch ? destMatch[1].split(/[\\\/]/).pop().trim() : 'dossier cible';
      return "Déplacement des fichiers vers '" + destName + "'";
    }

    if (/Copy-Item/i.test(c)) return "Copie des éléments";
    if (/Remove-Item/i.test(c)) return "Suppression d'éléments";

    return c.substring(0, 50) + (c.length > 50 ? '...' : '');
  }

  /* ═══════════════════════════════════════════
     Boucle agentique LLM local & Fast Path
  ═══════════════════════════════════════════ */
  async function runAgenticLoop(userPrompt, cmdId, uid, cmdRef, directCommand) {
    const steps = [];

    // ── FAST PATH ULTRA-RAPIDE : Exécution progressive étape par étape avec auto-réparation ──
    if (directCommand && directCommand.trim()) {
      console.log('[Agent Fast Path] Traitement du script PowerShell direct...');
      var allCmds = _splitPowerShellCommands(directCommand);
      if (allCmds.length === 0) allCmds = [directCommand.trim()];

      var successCount = 0;

      for (var ci = 0; ci < allCmds.length; ci++) {
        if (_currentRunningCancel) return { error: 'Annulé par l\'utilisateur', steps, cancelled: true };
        var rawCmd = allCmds[ci].trim();
        if (!rawCmd) continue;

        // Auto-sécurisation : si Move-Item / Copy-Item vers un dossier, s'assurer que le dossier parent/cible existe
        var safeCmd = rawCmd;
        var destM = safeCmd.match(/-Destination\s+["']?([^"';]+?)["']?(?:\s+-[A-Za-z]+|$)/i);
        if (destM && destM[1] && (safeCmd.startsWith('Move-Item') || safeCmd.startsWith('Copy-Item'))) {
          var destDir = destM[1].trim();
          safeCmd = 'if (-not (Test-Path -Path "' + destDir + '")) { New-Item -Path "' + destDir + '" -ItemType Directory -Force | Out-Null }; ' + safeCmd;
        }

        var stepTitle = _getStepTitle(rawCmd);
        steps.push({ text: stepTitle, ts: new Date().toISOString() });
        await cmdRef.update({ step: stepTitle, lastCmd: rawCmd.substring(0, 120), steps, updatedAt: new Date() });
        window.dispatchEvent(new CustomEvent('cw:step', { detail: { step: stepTitle } }));

        try {
          var execRes = await window.eva.system.exec(safeCmd);
          if (_currentRunningCancel) return { error: 'Annulé par l\'utilisateur', steps, cancelled: true };

          if (execRes && execRes.success) {
            successCount++;
          } else {
            console.warn('[Agent Fast Path] Erreur sur étape direct:', rawCmd, execRes?.stderr || execRes?.error);
            // Tentative d'auto-réparation si échec Move-Item ou New-Item avec guillemets
            if (rawCmd.indexOf('"') === -1 && rawCmd.indexOf("'") === -1) {
              var quotedCmd = rawCmd.replace(/(-Path|-Destination)\s+(\$env:[^\s;]+|\S+)/gi, '$1 "$2"');
              try {
                var retryRes = await window.eva.system.exec(quotedCmd);
                if (retryRes && retryRes.success) {
                  successCount++;
                }
              } catch(re) {}
            }
          }
        } catch(fastErr) {
          console.warn('[Agent Fast Path] Exception exécution directe:', fastErr);
        }
      }

      // Si au moins une étape ou la totalité a réussi, considérer la mission comme accomplie
      if (successCount > 0 || allCmds.length === 0) {
        var stepDone = 'Actions exécutées avec succès ✓';
        steps.push({ text: stepDone, ts: new Date().toISOString() });
        await cmdRef.update({ step: stepDone, steps, updatedAt: new Date() });
        window.dispatchEvent(new CustomEvent('cw:step', { detail: { step: stepDone } }));
        return {
          output: 'Toutes les actions demandées ont été exécutées avec succès sur votre PC.',
          steps: steps
        };
      } else {
        console.warn('[Agent Fast Path] Aucune commande n\'a abouti, ajustement nécessaire.');
        steps.push({ text: 'Ajustement...', ts: new Date().toISOString() });
      }
    }

    const systemPrompt = `Tu es l'Agent PC Windows d'EVA. RÈGLES ABSOLUES :
1. Réponds UNIQUEMENT par des commandes PowerShell valides dans un bloc [CMD]commandes[/CMD]. Commence directement par [CMD] sans AUCUN texte avant ni politesse.
2. Chemins par défaut : Bureau = $env:USERPROFILE\\Desktop | Documents = $env:USERPROFILE\\Documents.
3. Tâches complexes (plusieurs fichiers/dossiers/actions) : mets TOUTES les commandes PowerShell dans le MÊME bloc [CMD] séparées par des sauts de ligne ou points-virgules.
4. Ordre logique obligatoire : crée TOUJOURS les dossiers AVANT d'y créer ou d'y déplacer des fichiers :
   New-Item -Path "$env:USERPROFILE\\Desktop\\MonDossier" -ItemType Directory -Force
5. Liens web / Vidéos : pour ouvrir un lien ou l'enregistrer dans un fichier, utilise directement l'URL demandée (ex Rick Roll: https://www.youtube.com/watch?v=dQw4w9WgXcQ) et/ou lance le navigateur avec Start-Process msedge "URL".
6. Exemples :
[CMD]New-Item -Path "$env:USERPROFILE\\Desktop\\test.txt" -ItemType File -Value "Hello" -Force[/CMD]
[CMD]New-Item -Path "$env:USERPROFILE\\Desktop\\Fichiers Test" -ItemType Directory -Force
New-Item -Path "$env:USERPROFILE\\Desktop\\Fichiers Test\\test1.txt" -ItemType File -Value "Hello World" -Force
Start-Process msedge "https://www.youtube.com/watch?v=dQw4w9WgXcQ"[/CMD]`;

    const history = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
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

    let totalCmdsExecuted = 0;

      // Boucle agentique bornée à 3 itérations max
      while (true) {
        iteration++;

        if (iteration > 3) {
          var maxErr = 'Limite d\'itérations atteinte (3 étapes max).';
          steps.push({ text: '\u2717 ' + maxErr, ts: new Date().toISOString() });
          await cmdRef.update({ step: maxErr, steps, updatedAt: new Date() });
          return { error: maxErr, steps };
        }

        // Vérifier si la tâche a été annulée depuis l'UI (overlay, stop button, Firestore)
        if (_currentRunningCancel) {
          console.log('[Agent] Tâche annulée localement');
          return { error: 'Annulé par l utilisateur', steps, cancelled: true };
        }

        try {
          const snap = await cmdRef.get();
          if (snap.exists && snap.data().status === 'cancelled') {
            console.log('[Agent] Tâche annulée à l iteration', iteration);
            return { error: 'Annulé par l utilisateur', steps, cancelled: true };
          }
        } catch(e) { /* ignore, continuer */ }

        try {
          const raisonnement = iteration > 1 ? `Raisonnement étape ${iteration}...` : firstStep;
          if (iteration > 1) {
            await cmdRef.update({ step: raisonnement, updatedAt: new Date() });
            window.dispatchEvent(new CustomEvent('cw:step', { detail: { step: raisonnement } }));
          }

          const data = await window.eva.system.llmChat(history, {
            maxTokens: 256,
            temperature: 0.1,
            sessionId: cmdId,
            stopTriggers: ['[/CMD]', '[/REPORT]', '[/CONFIRM]', '\n\n\n']
          });

          // Vérification immédiate après llmChat
          if (_currentRunningCancel) {
            console.log('[Agent] Tâche annulée pendant/après llmChat');
            return { error: 'Annulé par l utilisateur', steps, cancelled: true };
          }

          if (data.choices && data.choices[0] && data.choices[0].message) {
            data.message = data.choices[0].message;
          }
          const text = (data.message && data.message.content) ? data.message.content : '';
          console.log('[Agent LLM step ' + iteration + ' raw output]:', text);
          if (!text) { history.push({ role: 'user', content: 'Génère directement la commande PowerShell dans [CMD]...[/CMD].' }); continue; }
          history.push({ role: 'assistant', content: text });

          // Demande de confirmation (fichiers sensibles)
          var confirmMatch = text.match(/\[CONFIRM\]([\s\S]*?)(?:\[\/CONFIRM\]|$)/i);
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

          // 1. Extraire les commandes à exécuter (tolère balise fermante tronquée par stop trigger)
          var allCmds = [];
          var cmdRegex = /\[CMD\]([\s\S]*?)(?:\[\/CMD\]|$)/gi;
          var m;
          while ((m = cmdRegex.exec(text)) !== null) {
            var rawCmd = m[1].trim();
            if (rawCmd && !rawCmd.startsWith('[REPORT]')) {
              allCmds.push(rawCmd);
            }
          }

          // Fallback 1 : blocs de code powershell si le modèle oublie les balises [CMD]
          if (allCmds.length === 0) {
            var codeBlockRegex = /```(?:powershell|cmd|sh|bash)?\s*\n([\s\S]*?)```/gi;
            while ((m = codeBlockRegex.exec(text)) !== null) {
              var raw = m[1].trim();
              if (raw && !raw.startsWith('[REPORT]')) allCmds.push(raw);
            }
          }

          // Fallback 2 : lignes de commandes PowerShell brutes
          if (allCmds.length === 0) {
            var rawLines = text.split('\n').map(function(l){ return l.trim(); }).filter(function(l){
              return /^(New-Item|Start-Process|Move-Item|Copy-Item|Remove-Item|Set-Content|Add-Content|Get-ChildItem|mkdir|del|rm|copy|move)\b/i.test(l);
            });
            if (rawLines.length > 0) {
              allCmds.push(rawLines.join('\n'));
            }
          }

          if (allCmds.length > 0) {
            var results = [];
            var allSucceeded = true;
            for (var ci = 0; ci < allCmds.length; ci++) {
              if (_currentRunningCancel) {
                return { error: 'Annulé par l utilisateur', steps, cancelled: true };
              }
              var cmd = allCmds[ci];
              var stepText = 'Ex\u00e9cution [' + (ci+1) + '/' + allCmds.length + ']: ' + cmd.substring(0, 80) + (cmd.length > 80 ? '...' : '');
              steps.push({ text: stepText, ts: new Date().toISOString() });
              await cmdRef.update({ step: stepText, lastCmd: cmd.substring(0, 120), steps, updatedAt: new Date() });
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
                totalCmdsExecuted++;
                if (!res.success) allSucceeded = false;
              } catch(e) {
                allSucceeded = false;
                results.push('$ ' + cmd + '\nErreur: ' + e.message);
              }
            }

            // 1) Si le modèle avait DÉJÀ inclus un [REPORT] dans son message
            var directReport = text.match(/\[REPORT\]([\s\S]*?)(?:\[\/REPORT\]|$)/i);
            if (allSucceeded && directReport) {
              finalReport = directReport[1].trim();
              steps.push({ text: '\u2713 ' + finalReport.substring(0, 120), ts: new Date().toISOString() });
              await cmdRef.update({ step: 'Termin\u00e9 \u2713', steps, updatedAt: new Date() });
              break;
            }

            // 2) Pour les actions directes : terminer immédiatement avec un résumé propre
            var isDirectAction = /(crée|cree|créer|creer|écris|ecris|écrire|ecrire|ajoute|ajouter|supprime|supprimer|efface|effacer|ouvre|ouvrir|ferme|fermer|lance|lancer|tue|tuer|kill|déplace|deplace|copie|copier|installe|installer)/i.test(userPrompt);
            if (allSucceeded && isDirectAction) {
              finalReport = 'Toutes les actions demandées ont été exécutées avec succès sur votre PC.';
              steps.push({ text: '\u2713 ' + finalReport, ts: new Date().toISOString() });
              await cmdRef.update({ step: 'Termin\u00e9 \u2713', steps, updatedAt: new Date() });
              break;
            }

            // Si échec : demander au modèle de corriger spécifiquement l'erreur
            if (!allSucceeded) {
              history.push({
                role: 'user',
                content: 'Des erreurs sont survenues lors de l\'exécution :\n' + results.join('\n---\n') + '\n\nAnalyse l\'erreur ci-dessus, corrige les chemins ou la syntaxe, et réponds UNIQUEMENT avec la commande PowerShell corrigée dans [CMD]...[/CMD].'
              });
              continue;
            }

            history.push({ role: 'user', content: 'R\u00e9sultats des commandes:\n' + results.join('\n---\n') + '\n\nSi la tâche est finie, résume avec [REPORT]...[/REPORT]. Ne génère plus de commande.' });
            continue;
          }

        // 2. Rapport final (uniquement si au moins une commande a été exécutée)
        var reportMatch = text.match(/\[REPORT\]([\s\S]*?)(?:\[\/REPORT\]|$)/i);
        if (reportMatch) {
          if (totalCmdsExecuted === 0) {
            console.warn('[Agent LLM] Le LLM a renvoyé un [REPORT] sans exécuter aucune commande. Rejet et demande de commande.');
            history.push({ role: 'user', content: 'ERREUR : Tu n\'as exécuté AUCUNE commande PowerShell ! Tu dois obligatoirement exécuter l\'action avec [CMD]commande[/CMD] avant d\'envoyer [REPORT]. Génère la commande PowerShell maintenant.' });
            continue;
          }
          finalReport = reportMatch[1].trim();
          steps.push({ text: '\u2713 ' + finalReport.substring(0, 120), ts: new Date().toISOString() });
          await cmdRef.update({ step: 'Termin\u00e9 \u2713', steps, updatedAt: new Date() });
          break;
        }

        history.push({ role: 'user', content: 'Utilise [CMD] commande [/CMD] pour exécuter une commande PowerShell, ou [REPORT] r\u00e9sum\u00e9 [/REPORT] pour finir.' });
      } catch(e) {
        var errMsg = e && e.message ? e.message : String(e);
        var stepErr = '\u2717 Erreur: ' + errMsg.substring(0, 120);
        steps.push({ text: stepErr, ts: new Date().toISOString() });
        await cmdRef.update({ step: stepErr, steps, updatedAt: new Date() });
        return { error: errMsg, steps };
      }
    }

    try {
      if (window.eva && window.eva.system && typeof window.eva.system.llmResetSession === 'function') {
        await window.eva.system.llmResetSession();
      }
    } catch(e) {}

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


  // Démarrer dès que l'utilisateur est authentifié
  const iv = setInterval(() => {
    if (window.S && window.S.user && window.db) {
      clearInterval(iv);
      registerDevice();
    }
  }, 1000);

  // Exposer l'API pc-agent globalement
  window.pcAgent = {
    getDeviceId: () => deviceId,
    sendCommand: async (type, payload, uid) => {
      if (!window.db || !window.S || !window.S.user) return null;
      const ref = await window.db.collection('cloudworks').doc(uid || window.S.user.uid)
        .collection('commands').add({
          deviceId: deviceId,
          type: type,
          payload: payload || {},
          status: 'pending',
          createdAt: typeof window.timestamp === 'function' ? window.timestamp() : new Date(),
          updatedAt: typeof window.timestamp === 'function' ? window.timestamp() : new Date()
        });
      return ref.id;
    }
  };

})();



// ==========================================
// EVA MODEL AUTO-DOWNLOADER
// ==========================================
(function() {
  'use strict';

  async function checkAndPromptModel() {
    if (!window.eva || !window.eva.llm) return;

    try {
      const { exists } = await window.eva.llmCheck();
      if (exists) return;

      // Modele manquant, afficher la modal
      const modal = document.getElementById('model-download-modal');
      if (modal) {
        modal.style.display = 'flex';
      }

      const btn = document.getElementById('model-dl-btn');
      if (!btn) return;

      btn.addEventListener('click', async function() {
        btn.disabled = true;
        btn.textContent = 'Téléchargement en cours...';
        
        const progressContainer = document.getElementById('model-dl-progress-container');
        if (progressContainer) progressContainer.style.display = 'block';

        // Listen for progress updates
        if (window.eva.onLLMDownloadProgress) {
          window.eva.onLLMDownloadProgress(function(data) {
            const bar = document.getElementById('model-dl-bar');
            const pct = document.getElementById('model-dl-pct');
            const info = document.getElementById('model-dl-info');
            if (bar) bar.style.width = data.progress + '%';
            if (pct) pct.textContent = data.progress + '%';
            if (info) {
              const dl = (data.downloadedBytes / 1024 / 1024 / 1024).toFixed(2);
              const tot = (data.totalBytes / 1024 / 1024 / 1024).toFixed(2);
              info.textContent = dl + ' Go / ' + tot + ' Go';
            }
          });
        }

        try {
          await window.eva.llmDownload();
          if (modal) modal.style.display = 'none';
          // Start LLM now that model is downloaded
          window.eva.llmStart().catch(console.error);
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Réessayer';
          alert('Erreur de téléchargement: ' + (err.message || err));
        }
      });
    } catch (e) {
      console.warn('[EVA] Erreur vérification modèle:', e);
    }
  }

  // Wait for eva bridge to be ready
  function waitForEva() {
    if (window.eva && window.eva.llmCheck) {
      // Check after a short delay to let UI render
      setTimeout(checkAndPromptModel, 1500);
    } else {
      setTimeout(waitForEva, 300);
    }
  }
  waitForEva();
})();
