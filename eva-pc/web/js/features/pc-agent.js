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

      // Récupérer un deviceId persistant ou en créer un
      deviceId = localStorage.getItem('cw_device_id');
      if (!deviceId) {
        deviceId = 'PC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        localStorage.setItem('cw_device_id', deviceId);
      }
      // Exposer globalement pour le system prompt
      window._cwDeviceId = deviceId;

      let osInfo = 'Windows';
      let localIP = '127.0.0.1';
      let hostname = 'EVA Desktop';

      if (window.eva && window.eva.system) {
        try {
          const info = await window.eva.system.info();
          if (info.success && info.os) {
            osInfo = info.os.distro || info.os.platform;
            hostname = info.os.hostname || 'EVA Desktop';
          }
          if (info.success && info.net) {
            const defaultNet = info.net.find(n => n.ip4 && !n.internal);
            if (defaultNet) localIP = defaultNet.ip4;
          }
        } catch(e){}
      }

      const ts = typeof window.timestamp === 'function' ? window.timestamp() : new Date();
      const docRef = window.db.collection('cloudworks').doc(uid).collection('devices').doc(deviceId);
      window.pcAgentDocRef = docRef;

      await docRef.set({
        deviceId: deviceId,
        deviceName: hostname || 'EVA Desktop',
        deviceType: 'windows',
        localIP: localIP,
        osVersion: osInfo,
        online: true,
        lastSeen: ts,
        sessionId: (window.S && window.S.sessionId) ? window.S.sessionId : null,
        appVersion: (window.eva && window.eva.app) ? await window.eva.app.version().catch(()=>'?') : '?'
      }, { merge: true });

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
        status = (resultData && resultData.error) ? 'error' : 'done';
      }
      else if (data.type === 'sysinfo') {
        await _updateStep(cmdRef, 'Récupération infos système...');
        const res = await window.eva.system.info();
        if (res.success) {
          resultData = {
            os: res.os.distro,
            hostname: res.os.hostname,
            uptime: Math.floor(res.os.uptime / 3600) + 'h',
            cpu: res.cpu.brand,
            ramTotal: Math.floor(res.mem.total / 1e9) + ' GB',
            ramFree: Math.floor(res.mem.free / 1e9) + ' GB',
            localIP: res.net[0]?.ip4 || '127.0.0.1'
          };
          await _updateStep(cmdRef, 'Infos récupérées ✓');
        } else throw new Error(res.error);
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

    // Mettre à jour Firebase avec le résultat final
    await cmdRef.update({
      status: status,
      result: resultData,
      updatedAt: typeof window.timestamp === 'function' ? window.timestamp() : new Date()
    });

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
        var reportMatch = text.match(/\[REPORT\]([\s\S]*?)\[\/REPORT\]/i);
        if (reportMatch) {
          finalReport = reportMatch[1].trim();
          steps.push({ text: '\u2713 ' + finalReport.substring(0, 100), ts: new Date().toISOString() });
          await cmdRef.update({ step: 'Terminé \u2713', steps, updatedAt: new Date() });
          break;
        }

        // Commandes à exécuter ?
        var allCmds = [];
        var regex = /\[CMD\]([\s\S]*?)\[\/CMD\]/gi;
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
              results.push('$ ' + cmd + '\n' + out);
            } catch(e) { results.push('$ ' + cmd + '\nErreur: ' + e.message); }
          }
          history.push({ role: 'user', content: 'Résultats:\n' + results.join('\n---\n') + '\n\nContinue ou termine avec [REPORT].' });
        } else {
          // Pas de [CMD] ni [REPORT] → forcer
          history.push({ role: 'user', content: 'Utilise [CMD] commande [/CMD] pour agir ou [REPORT] résumé [/REPORT] pour finir.' });
        }
      } catch(e) {
        var errMsg = e && e.message ? e.message : String(e);
        var stepErr = 'Erreur LLM: ' + errMsg.substring(0, 100);
        steps.push({ text: '\u2717 ' + stepErr, ts: new Date().toISOString() });
        await cmdRef.update({ step: stepErr, steps, updatedAt: new Date() });
        return { error: errMsg, steps };
      }
    }
    if (!finalReport) finalReport = 'Tâche terminée (limite de 15 itérations atteinte).';
    return { output: finalReport, steps };
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
