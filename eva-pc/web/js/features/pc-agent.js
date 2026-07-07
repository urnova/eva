(async function() {
  'use strict';

  let unsubCmds = null;
  let deviceId = null;

  async function registerDevice() {
    if (!window.S || !window.S.user || !window.db) return;
    try {
      const uid = window.S.user.uid;
      
      // Essayer de récupérer un deviceId local ou le créer
      // Essayer de récupérer un deviceId local ou le créer
      deviceId = localStorage.getItem('cw_device_id');
      if (!deviceId) {
        deviceId = 'PC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        localStorage.setItem('cw_device_id', deviceId);
      }

      let osInfo = 'Windows';
      let localIP = '127.0.0.1';
      
      if (window.eva && window.eva.system) {
        try {
          const info = await window.eva.system.info();
          if (info.success && info.os) osInfo = info.os.distro || info.os.platform;
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
        deviceName: 'EVA Desktop',
        deviceType: 'windows',
        localIP: localIP,
        osVersion: osInfo,
        online: true,
        lastSeen: ts
      }, { merge: true });

      console.log('[CloudWorks] Enregistré sous ID:', deviceId);

      // Écouter les commandes
      listenCommands(uid);
      
      // Mettre à jour lastSeen toutes les minutes
      setInterval(() => {
        docRef.update({
          online: true,
          lastSeen: typeof window.timestamp === 'function' ? window.timestamp() : new Date()
        }).catch(()=>{});
      }, 60000);

      // S'assurer de passer hors-ligne à la fermeture
      window.addEventListener('beforeunload', () => {
        docRef.update({ online: false, lastSeen: typeof window.timestamp === 'function' ? window.timestamp() : new Date() }).catch(()=>{});
      });
      
      if (window.eva && window.eva.onAppRequestQuit) {
        window.eva.onAppRequestQuit(async () => {
          try {
            await docRef.update({ online: false, lastSeen: typeof window.timestamp === 'function' ? window.timestamp() : new Date() });
          } catch(e) {}
          window.eva.sendQuitReady();
        });
      }

    } catch (e) {
      console.error('[CloudWorks] Erreur enregistrement:', e);
    }
  }

  function listenCommands(uid) {
    if (unsubCmds) unsubCmds();
    unsubCmds = window.db.collection('cloudworks').doc(uid).collection('commands')
      .where('deviceId', '==', deviceId)
      .where('status', '==', 'pending')
      .onSnapshot(async (snap) => {
        for (const change of snap.docChanges()) {
          if (change.type === 'added') {
            await handleCommand(change.doc.id, change.doc.data(), uid);
          }
        }
      });
  }

  async function handleCommand(cmdId, data, uid) {
    if (!window.eva || !window.eva.system) return;
    
    // Afficher l'overlay
    if (window.eva.overlay) {
      window.eva.overlay.show('cloudworks');
    }

    let resultData = null;
    let status = 'done';
    
    try {
      if (data.type === 'screenshot') {
        const res = await window.eva.system.screenshot();
        if (res.success) {
          resultData = { imageBase64: res.data };
        } else throw new Error(res.error);
      } 
      else if (data.type === 'sysinfo') {
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
        } else throw new Error(res.error);
      }
      else if (data.type === 'open_ide_file') {
        const filePath = data.payload?.filePath;
        if (filePath) {
          await window.eva.system.exec(`code "${filePath}"`);
          resultData = { output: 'Fichier ouvert dans VS Code.' };
        } else throw new Error('Chemin manquant');
      }
      else if (data.type === 'run_script') {
        const cmd = data.payload?.command;
        if (cmd) {
          const res = await window.eva.system.exec(cmd);
          if (res.success) {
            resultData = { stdout: res.stdout, stderr: res.stderr, exitCode: 0 };
          } else {
            resultData = { stderr: res.stderr || res.error, exitCode: 1 };
          }
        }
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
    } catch(err) {
      status = 'error';
      resultData = { error: err.message };
      console.error('[CloudWorks] Erreur commmande:', err);
    }

    // Mettre à jour Firebase
    await window.db.collection('cloudworks').doc(uid).collection('commands').doc(cmdId).update({
      status: status,
      result: resultData,
      updatedAt: typeof window.timestamp === 'function' ? window.timestamp() : new Date()
    });

    // Cacher l'overlay au bout de 2 secondes
    setTimeout(() => {
      if (window.eva.overlay) window.eva.overlay.hide();
    }, 2000);
  }

  // Démarrer dès que l'utilisateur est authentifié
  const iv = setInterval(() => {
    if (window.S && window.S.user && window.db) {
      clearInterval(iv);
      registerDevice();
    }
  }, 1000);

})();
