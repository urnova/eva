/**
 * pc-bridge.js — Pont EVA ↔ Electron
 * Chargé UNIQUEMENT quand l'app tourne dans Electron (window.eva existe).
 * Injecté dans chat.html et app-login.html via une balise <script>.
 */
(function() {
  'use strict';

  // Vérifier qu'on est bien dans Electron
  if (!window.eva) return;

  console.log('[PC Bridge] Initialisation du pont Electron ↔ EVA Web');

  /* ── 1. Titlebar : close/minimize/maximize active ── */
  var titlebar = document.getElementById('electronTitlebar');
  if (titlebar) {
    titlebar.style.display = 'flex';
    document.body.style.paddingTop = '32px';
  }

  /* ── 2. Bouton fermer : hover rouge ── */
  document.querySelectorAll('.tb-btn.close').forEach(function(btn) {
    btn.addEventListener('mouseenter', function() { btn.style.background = '#e81123'; btn.style.color = '#fff'; });
    btn.addEventListener('mouseleave', function() { btn.style.background = ''; btn.style.color = ''; });
  });

  /* ── 3. Cacher les boutons web inutiles sur PC ── */
  function hidePCUnnecessaryElements() {
    // Bouton "Ouvrir l'app" dans le header (on est déjà dans l'app)
    var installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.style.display = 'none';
    // Bannière PWA
    var pwaBanner = document.getElementById('pwaBanner');
    if (pwaBanner) pwaBanner.style.display = 'none';
  }

  /* ── 4. Injecter le badge PC dans la sidebar ── */
  function injectPCBadge() {
    var userBadgeWrap = document.getElementById('userBadgeText');
    if (userBadgeWrap) {
      var pcBadge = document.createElement('div');
      pcBadge.style.cssText = 'font-size:0.6em;color:rgba(123,139,245,0.7);margin-top:2px;letter-spacing:1.5px;';
      pcBadge.textContent = 'PC DESKTOP';
      if (!document.getElementById('pcDesktopBadge')) {
        pcBadge.id = 'pcDesktopBadge';
        if (userBadgeWrap.parentNode) userBadgeWrap.parentNode.insertBefore(pcBadge, userBadgeWrap.nextSibling);
      }
    }
  }

  /* ── 5. Auto-Lancement au démarrage (dans Compte → Paramètres) ── */
  window.eva.autoLaunch.get().then(function(enabled) {
    window._pcAutoLaunch = enabled;
  }).catch(function() {});

  /* ── 6. Ouvrir les liens <a target="_blank"> dans le navigateur système ── */
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href^="http"]');
    if (link && link.target === '_blank') {
      e.preventDefault();
      if (window.eva && window.eva.openExternal) {
        window.eva.openExternal(link.href);
      }
    }
  }, true);

  /* ── 7. Ajouter un onglet "PC Settings" dans la modale des paramètres ── */
  function injectPCSettingsTab() {
    var navContainer = document.querySelector('.settings-nav-list') ||
                       document.querySelector('.modal-nav');
    if (!navContainer || document.querySelector('[data-section="pc"]')) return;

    var pcBtn = document.createElement('button');
    pcBtn.className = 'settings-nav';
    pcBtn.setAttribute('data-section', 'pc');
    pcBtn.innerHTML =
      '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>' +
      'Application PC';
    pcBtn.addEventListener('click', function() {
      document.querySelectorAll('.settings-nav').forEach(function(n) { n.classList.remove('active'); });
      pcBtn.classList.add('active');
      renderPCSettings();
    });
    navContainer.appendChild(pcBtn);
  }

  /* ── 8. Rendu de la section PC Settings ── */
  async function renderPCSettings() {
    var c = document.getElementById('settingsContent');
    if (!c) return;

    var version = await window.eva.app.version().catch(function() { return '—'; });
    var autoLaunch = await window.eva.autoLaunch.get().catch(function() { return false; });

    c.innerHTML =
      '<div class="settings-section">' +
      '<div class="settings-section-title">Application PC</div>' +

      /* Version */
      '<div class="settings-row" style="padding:10px 0;border-bottom:1px solid var(--border)">' +
        '<div><div class="settings-row-label">Version</div><div class="settings-row-sub">EVA Desktop</div></div>' +
        '<div style="font-size:0.82em;color:var(--cyan)">v' + version + '</div>' +
      '</div>' +

      /* Démarrage auto */
      '<div class="settings-row" style="padding:10px 0;border-bottom:1px solid var(--border)">' +
        '<div><div class="settings-row-label">Démarrage automatique</div><div class="settings-row-sub">Lancer EVA au démarrage de Windows</div></div>' +
        '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;">' +
          '<input type="checkbox" id="pcAutoLaunch"' + (autoLaunch ? ' checked' : '') + ' style="accent-color:var(--cyan);width:16px;height:16px;" onchange="window._setPCAutoLaunch(this.checked)">' +
          '<span style="font-size:0.78em;color:var(--text-muted)">Activé</span>' +
        '</label>' +
      '</div>' +

      /* Réduire dans le tray */
      '<div class="settings-row" style="padding:10px 0;border-bottom:1px solid var(--border)">' +
        '<div><div class="settings-row-label">Zone de notification</div><div class="settings-row-sub">Réduire dans le tray plutôt que fermer</div></div>' +
        '<span style="color:var(--cyan);font-size:0.75em">Auto</span>' +
      '</div>' +
      '</div>' +

      /* Commandes système */
      '<div class="settings-section">' +
      '<div class="settings-section-title">Commandes Système</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<button class="btn btn-secondary" onclick="window.eva.system.screenshot().then(function(p){if(p)toast(\'Capture : \'+p,\'success\')}).catch(function(){toast(\'Erreur capture\',\'error\')})" style="text-align:left">📸 Capture d\'écran</button>' +
        '<button class="btn btn-secondary" onclick="window.eva.app.path().then(function(p){toast(p,\'info\')})" style="text-align:left">📂 Chemin de l\'installation</button>' +
      '</div>' +
      '</div>';
  }

  /* ── 9. Handler global pour le toggle auto-launch ── */
  window._setPCAutoLaunch = function(enabled) {
    window.eva.autoLaunch.set(enabled)
      .then(function() {
        if (window.toast) toast('Démarrage automatique ' + (enabled ? 'activé' : 'désactivé'), 'success');
      })
      .catch(function(e) {
        if (window.toast) toast('Erreur : ' + e.message, 'error');
      });
  };

  /* ── 10. Navigation (depuis menu tray) ── */
  if (window.eva.onNavigate) {
    window.eva.onNavigate(function(route) {
      console.log('[PC Bridge] Navigation vers', route);
      if (route === 'chat' && window.openChat) window.openChat();
      else if (route === 'notes' && window.openNotes) window.openNotes();
      else if (route === 'alarms' && window.openAlarms) window.openAlarms();
      else if (route === 'cloudworks') {
        // Ouvrir le panneau CloudWorks dans le chat
        if (window.openSection) window.openSection('cloudworks');
        else if (window.showCloudWorks) window.showCloudWorks();
      }
    });
  }

  if (window.eva.onNewChat) {
    window.eva.onNewChat(function() {
      if (window.newConversation) window.newConversation();
    });
  }

  /* ── Wake Word depuis l'overlay (application en arrière-plan) ── */
  // Canal principal : main.ts → chat via wakeword:command
  if (window.eva.onWakeWordCommand) {
    window.eva.onWakeWordCommand(function(text) {
      console.log('[PC Bridge] Wake word commande reçue:', text);
      _submitWakeWordCommand(text);
    });
  }
  // Canal secondaire : overlay → main → chat via overlay:action
  if (window.eva.overlay && window.eva.overlay.onAction) {
    window.eva.overlay.onAction(function(action, data) {
      if (action === 'wakeword' && data) {
        console.log('[PC Bridge] Wake word via overlay:', data);
        _submitWakeWordCommand(data);
      }
    });
  }

  function _submitWakeWordCommand(text) {
    if (!text || !text.trim()) return;
    var t = text.trim();
    // Mettre le texte dans l'input du chat
    var input = document.getElementById('userInput') ||
                document.getElementById('messageInput') ||
                document.querySelector('textarea.chat-textarea') ||
                document.querySelector('.chat-input textarea');
    if (input) {
      input.value = t;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    // Soumettre après 300ms
    setTimeout(function() {
      var sendBtn = document.getElementById('sendBtn') ||
                   document.querySelector('[data-action="send"]') ||
                   document.querySelector('.send-btn button') ||
                   document.querySelector('button.btn-send');
      if (sendBtn) {
        sendBtn.click();
      } else if (window.sendMessage) {
        window.sendMessage(t);
      } else if (window.handleUserMessage) {
        window.handleUserMessage(t);
      } else {
        // Dernier recours : simuler Entrée dans l'input
        if (input) input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      }
    }, 300);
  }
  window._submitWakeWordCommand = _submitWakeWordCommand;

  /* ── 11. Initialisation du Node CloudWorks (Worker en arrière-plan) ── */
  function initCloudWorksNode() {
    if (!window.S || !window.S.user || !window.db) return;
    var uid = window.S.user.uid;
    
    // Récupérer ou générer un Device ID
    var deviceId = localStorage.getItem('cw_device_id');
    if (!deviceId) {
      deviceId = 'PC-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      localStorage.setItem('cw_device_id', deviceId);
    }

    var deviceRef = window.db.collection('cloudworks').doc(uid).collection('devices').doc(deviceId);
    
    // Ping régulier
    function ping() {
      window.eva.system.info().then(function(info) {
        if (!info || !info.success) return;
        deviceRef.set({
          deviceId: deviceId,
          deviceName: info.hostname || 'PC Desktop',
          deviceType: window.eva.app.platform() === 'win32' ? 'windows' : window.eva.app.platform() === 'darwin' ? 'mac' : 'linux',
          osVersion: info.os || '',
          localIP: info.localIP || '',
          online: true,
          lastSeen: window.timestamp ? window.timestamp() : new Date()
        }, {merge: true}).catch(function(){});
      }).catch(function(){});
    }
    
    ping();
    setInterval(ping, 30000);
    
    window.addEventListener('beforeunload', function() {
      deviceRef.update({online: false, lastSeen: window.timestamp ? window.timestamp() : new Date()}).catch(function(){});
    });

    // Écouter les requêtes en attente
    window.db.collection('cloudworks').doc(uid).collection('commands')
      .where('deviceId', '==', deviceId)
      .where('status', '==', 'pending')
      .onSnapshot(function(snap) {
        snap.docChanges().forEach(function(change) {
          if (change.type === 'added') {
            var cmd = change.doc.data();
            var cmdId = change.doc.id;
            executeCommand(cmdId, cmd);
          }
        });
      }, function(error) {
        console.error('[CloudWorks] Node error:', error);
      });
      
    // Exécution locale
    function executeCommand(cmdId, cmd) {
      var cmdRef = window.db.collection('cloudworks').doc(uid).collection('commands').doc(cmdId);
      cmdRef.update({status: 'running', updatedAt: window.timestamp ? window.timestamp() : new Date()}).catch(function(){});
      
      var p = null;
      var isDirectResult = false;
      
      if (cmd.type === 'sysinfo') {
        p = window.eva.system.info();
      } else if (cmd.type === 'screenshot') {
        p = window.eva.system.screenshot().then(function(res) {
          if (res && res.success) {
            return { imageBase64: res.data };
          }
          throw new Error(res.error || 'Erreur screenshot');
        });
        isDirectResult = true;
      } else if (cmd.type === 'lock') {
        p = window.eva.system.lock();
      } else if (cmd.type === 'sleep') {
        p = window.eva.system.sleep();
      } else if (cmd.type === 'shutdown') {
        p = window.eva.system.shutdown();
      } else if (cmd.type === 'run_script') {
        p = window.eva.system.exec(cmd.payload.command).then(function(res) {
          return {
            stdout: res.stdout || '',
            stderr: res.stderr || '',
            exitCode: res.success ? 0 : 1
          };
        });
        isDirectResult = true;
      } else if (cmd.type === 'open_ide_file') {
        if (window.openFileInIDE) window.openFileInIDE(cmd.payload.filePath);
        p = Promise.resolve({ success: true, message: 'Fichier ouvert dans l\'IDE' });
        isDirectResult = true;
      }
      
      if (p && p.then) {
        p.then(function(res) {
          var result = isDirectResult ? res : (res && res.success !== undefined ? res : { success: true });
          if (cmd.type === 'sysinfo' && res.success) result = res;
          cmdRef.update({status: 'done', result: result, updatedAt: window.timestamp ? window.timestamp() : new Date()});
        }).catch(function(err) {
          cmdRef.update({status: 'error', error: err.message || String(err), updatedAt: window.timestamp ? window.timestamp() : new Date()});
        });
      }
    }
  }

  /* ── Init différée (attendre que le DOM soit prêt) ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      hidePCUnnecessaryElements();
      injectPCBadge();
    });
    document.addEventListener('eva:authReady', function() {
      injectPCSettingsTab();
      initCloudWorksNode();
    });
  } else {
    hidePCUnnecessaryElements();
    injectPCBadge();
    document.addEventListener('eva:authReady', function() {
      injectPCSettingsTab();
      initCloudWorksNode();
    });
  }

  console.log('[PC Bridge] Prêt.');
})();
