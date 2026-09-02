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
      if (macAddress) {
        deviceId = 'MAC-' + macAddress.replace(/:/g, '-').toUpperCase();
        localStorage.setItem('cw_device_id', deviceId); // Mettre à jour si changé
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
          lastSeen: typeof window.timestamp === 'function' ? window.timestamp() : new Date()
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

  /* ═══════════════════════════════════════════
     Exécution d'une commande reçue
  ═══════════════════════════════════════════ */
  async function handleCommand(cmdId, data, uid) {
    if (!window.eva || !window.eva.system) return;
    const cmdRef = window.db.collection('cloudworks').doc(uid).collection('commands').doc(cmdId);

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
        await cmdRef.update({ status: 'running', updatedAt: new Date(), step: 'Démarrage du LLM local...' });
        resultData = await runAgenticLoop(prompt, cmdId, uid, cmdRef);
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
     Boucle agentique LLM local
  ═══════════════════════════════════════════ */
  async function runAgenticLoop(userPrompt, cmdId, uid, cmdRef) {
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

    // Boucle infinie — seul [REPORT], une erreur, ou une annulation l'arrête
    while (true) {
      iteration++;

      // Vérifier si la tâche a été annulée depuis l'UI (web ou PC)
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
