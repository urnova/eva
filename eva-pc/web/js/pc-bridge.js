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

  /* ══════════════════════════════════════════════════════════
     MODE JARVIS EN ARRIÈRE-PLAN (Bulle Vocale + TTS forcé + Boucle Conversationnelle)
     ══════════════════════════════════════════════════════════ */
  var FOLLOW_UP_PROMPTS = [
    "C'est tout ce que je peux faire pour vous ?",
    "Puis-je faire autre chose pour vous ?",
    "Avez-vous besoin d'autre chose ?",
    "Y a-t-il autre chose que je puisse faire pour vous ?"
  ];

  var FAREWELL_PROMPTS = [
    "Très bien, je reste à votre disposition !",
    "Parfait, je vous laisse !",
    "À votre service, bonne journée !",
    "Compris, à plus tard !"
  ];

  var CLOSING_REGEX = /\b(non|c'est bon|c'est tout|non merci|rien d'autre|ça ira|merci|au revoir|bonne journée|stop|ferme|quitter|rien)\b/i;

  var _jarvisFollowUpTimer = null;
  var _jarvisFollowUpSilence = null;
  var _jarvisConvInitialized = false;

  /* ── Gestion de la Session Vocale Dédiée sur Firebase ── */
  async function startJarvisConversation() {
    if (window.S && window.S.convId) return window.S.convId;
    if (!window.S || !window.S.user || !window.db) return null;

    try {
      var uid = window.S.user.uid;
      var now = (typeof window.timestamp === 'function') ? window.timestamp() : new Date();
      var timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      var title = '🎙️ Session Vocale — ' + timeStr;

      var convRef = window.db.collection('users').doc(uid).collection('conversations').doc();
      var convId = convRef.id;

      window.S.convId = convId;
      if (!window.S.messages) window.S.messages = [];
      window.S.conv = {};
      _jarvisConvInitialized = true;

      var prov = (typeof window.getActiveProvider === 'function' ? window.getActiveProvider() : (window.S.config && window.S.config.aiProvider)) || 'eva';
      var mdl = (typeof window.getActiveModel === 'function' ? window.getActiveModel() : (window.S.config && window.S.config.evaModel)) || '';

      var data = {
        title: title,
        lastMessage: 'Session vocale démarrée...',
        createdAt: now,
        updatedAt: now,
        aiProvider: prov,
        aiModel: mdl,
        isVoiceSession: true
      };

      await convRef.set(data);

      if (!window.S.convs) window.S.convs = [];
      window.S.convs.unshift(Object.assign({ id: convId }, data));
      if (typeof window.renderConvs === 'function') window.renderConvs();

      var hdr = document.getElementById('convTitleHeader');
      if (hdr) hdr.textContent = title;

      var expWrap = document.getElementById('hdrExportWrap');
      if (expWrap) expWrap.style.display = '';

      var ml = document.getElementById('messagesList');
      var welcome = document.getElementById('chatWelcome');
      if (welcome) welcome.style.display = 'none';

      if (!window.S.messages || window.S.messages.length === 0) {
        if (ml && ml.children.length === 0) ml.innerHTML = '';
        if (window.EVAChatHandler && typeof window.EVAChatHandler.clearContext === 'function') {
          window.EVAChatHandler.clearContext();
        }
      }

      console.log('[Jarvis Firebase] Nouvelle conversation vocale créée avec ID:', convId);
      return convId;
    } catch(e) {
      console.warn('[Jarvis Firebase] Erreur création conversation:', e);
      return null;
    }
  }
  window.startJarvisConversation = startJarvisConversation;

  async function updateJarvisConversationTitle(cmdText) {
    if (!window.S || !window.S.user || !window.S.convId || !window.db || !cmdText) return;
    try {
      var clean = cmdText.trim();
      if (!clean) return;
      var newTitle = '🎙️ ' + clean.charAt(0).toUpperCase() + clean.slice(1);
      if (newTitle.length > 50) newTitle = newTitle.slice(0, 47) + '...';

      var convRef = window.db.collection('users').doc(window.S.user.uid).collection('conversations').doc(window.S.convId);
      await convRef.update({
        title: newTitle,
        updatedAt: (typeof window.timestamp === 'function') ? window.timestamp() : new Date()
      });

      var c = window.S.convs && window.S.convs.find(function(x){ return x.id === window.S.convId; });
      if (c) c.title = newTitle;
      var hdr = document.getElementById('convTitleHeader');
      if (hdr && window.S.convId) hdr.textContent = newTitle;
      if (typeof window.renderConvs === 'function') window.renderConvs();
    } catch(e) {
      console.warn('[Jarvis Firebase] Erreur renommage conversation:', e);
    }
  }
  window.updateJarvisConversationTitle = updateJarvisConversationTitle;

  var _jarvisThinkingWatchdog = null;
  function _startJarvisThinkingWatchdog() {
    if (_jarvisThinkingWatchdog) {
      clearTimeout(_jarvisThinkingWatchdog);
      _jarvisThinkingWatchdog = null;
    }
    _jarvisThinkingWatchdog = setTimeout(function() {
      if (window._isJarvisActive && (window._jarvisState === 'processing' || window._jarvisState === 'thinking')) {
        console.warn('[Jarvis Watchdog] Délai de réflexion de 15s dépassé — déblocage automatique');
        if (window.S) {
          window.S.busy = false;
          window.S.cwRunning = false;
        }
        var timeoutMsg = "Le modèle met trop de temps à répondre. Veuillez réessayer votre question.";
        window._jarvisState = 'answering';
        if (window.eva && window.eva.overlay) {
          window.eva.overlay.setState('speaking', timeoutMsg);
        }
        if (window.EVATTS && typeof window.EVATTS.speakTextStreaming === 'function') {
          window.EVATTS.speakTextStreaming(timeoutMsg, window.S ? window.S.config : {});
        } else {
          setTimeout(function() {
            if (window.eva && window.eva.overlay) window.eva.overlay.hide();
          }, 4000);
        }
      }
    }, 15000);
  }

  function _clearJarvisThinkingWatchdog() {
    if (_jarvisThinkingWatchdog) {
      clearTimeout(_jarvisThinkingWatchdog);
      _jarvisThinkingWatchdog = null;
    }
  }

  async function closeJarvisConversation() {
    _clearJarvisThinkingWatchdog();
    if (_jarvisFollowUpTimer) { clearTimeout(_jarvisFollowUpTimer); _jarvisFollowUpTimer = null; }
    if (_jarvisFollowUpSilence) { clearTimeout(_jarvisFollowUpSilence); _jarvisFollowUpSilence = null; }
    window._jarvisListener = null;

    if (window.S && window.S.user && window.S.convId && window.db) {
      try {
        var convRef = window.db.collection('users').doc(window.S.user.uid).collection('conversations').doc(window.S.convId);
        await convRef.update({
          updatedAt: (typeof window.timestamp === 'function') ? window.timestamp() : new Date()
        });
      } catch(e) {}
    }
    _jarvisConvInitialized = false;
    window.S.convId = null;
    window._isJarvisActive = false;
    window._jarvisState = 'idle';
    if (typeof window.evaResetWakeWordState === 'function') window.evaResetWakeWordState();
    console.log('[Jarvis Firebase] Session vocale clôturée.');
  }
  window.closeJarvisConversation = closeJarvisConversation;

  function handleJarvisWakeWord(phrase, command) {
    console.log('[Jarvis] handleJarvisWakeWord déclenché:', { phrase: phrase, command: command });
    window._isJarvisActive = true;

    // Toujours nettoyer les anciens timers et le listener interactif précédent
    _clearJarvisThinkingWatchdog();
    if (_jarvisFollowUpTimer) { clearTimeout(_jarvisFollowUpTimer); _jarvisFollowUpTimer = null; }
    if (_jarvisFollowUpSilence) { clearTimeout(_jarvisFollowUpSilence); _jarvisFollowUpSilence = null; }
    window._jarvisListener = null;

    // Créer la session vocale Firebase seulement si aucune conversation n'est active
    if (!window.S || !window.S.convId) {
      startJarvisConversation();
    }

    var trimmedCmd = command ? command.trim() : '';

    // Intention vocale directe : ouvrir/afficher l'application
    if (trimmedCmd && /\b(ouvre|ouvrir|affiche|montre|bascule|mets)\s+(l'application|l'appli|l'interface|eva|la fen[eê]tre)\b/i.test(trimmedCmd)) {
      if (window.eva && window.eva.window && typeof window.eva.window.show === 'function') {
        window.eva.window.show();
      }
      var appOpenMsg = "J'ai ouvert l'application EVA sur votre écran.";
      window._jarvisState = 'answering';
      if (window.eva && window.eva.overlay) {
        window.eva.overlay.show('speaking');
        window.eva.overlay.setState('speaking', appOpenMsg);
      }
      if (window.EVATTS && typeof window.EVATTS.speakTextStreaming === 'function') {
        window.EVATTS.speakTextStreaming(appOpenMsg, window.S ? window.S.config : {});
      }
      return;
    }

    if (trimmedCmd.length > 1) {
      window._jarvisState = 'processing';
      updateJarvisConversationTitle(trimmedCmd);
      if (window.eva && window.eva.overlay) {
        window.eva.overlay.show('thinking', trimmedCmd);
        window.eva.overlay.setState('thinking', trimmedCmd);
      }
      _startJarvisThinkingWatchdog();
      _submitWakeWordCommand(trimmedCmd);
    } else {
      // L'utilisateur a dit "Eva" seul : affichage visuel en écoute pure
      // ZÉRO synthèse vocale ici pour éviter tout risque d'écho / auto-écoute !
      window._jarvisState = 'awaiting_command';
      if (window.eva && window.eva.overlay) {
        window.eva.overlay.show('listening', 'Je vous écoute... Posez votre question.');
        window.eva.overlay.setState('listening', 'Je vous écoute... Posez votre question.');
      }
    }
  }
  window.handleJarvisWakeWord = handleJarvisWakeWord;

  function handleJarvisVoiceCommand(query) {
    if (!query || !query.trim()) return;
    console.log('[Jarvis] Commande vocale reçue en arrière-plan:', query);
    handleJarvisWakeWord(query, query);
  }
  window.handleJarvisVoiceCommand = handleJarvisVoiceCommand;

  if (window.eva && window.eva.jarvis && window.eva.jarvis.onVoiceCommand) {
    window.eva.jarvis.onVoiceCommand(function(data) {
      var cmd = (data && data.command) || (data && data.phrase) || '';
      if (cmd && cmd.trim()) handleJarvisVoiceCommand(cmd.trim());
    });
  }

  // Écouter les étapes d'actions CloudWorks/QuickWorks pour mettre à jour l'overlay en temps réel
  window.addEventListener('cw:step', function(e) {
    if (window._isJarvisActive && window.eva && window.eva.overlay && e && e.detail && e.detail.step) {
      window.eva.overlay.setState('cloudworks', e.detail.step);
    }
  });

  // Écouter la fin d'une tâche CloudWorks pour vocaliser le compte-rendu et relancer le cycle vocal
  window.addEventListener('cw:task-done', function(e) {
    _clearJarvisThinkingWatchdog();
    console.log('[Jarvis CloudWorks] cw:task-done reçu :', e && e.detail);
    var detail = (e && e.detail) || {};
    var status = detail.status;
    var result = detail.result;

    if (window.S) {
      window.S.cwRunning = false;
      window.S.busy = false;
    }

    if (window._isJarvisActive) {
      var outputText = '';
      if (result && typeof result === 'object') {
        outputText = result.output || result.summary || (result.error ? ('Erreur : ' + result.error) : '');
      } else if (typeof result === 'string') {
        outputText = result;
      }

      var vocalReport = '';
      if (status === 'done' || status === 'completed') {
        vocalReport = outputText ? outputText : "C'est fait, j'ai terminé l'action demandée sur votre ordinateur.";
      } else if (status === 'cancelled' || status === 'aborted') {
        // Tâche annulée par l'utilisateur : ne PAS vocaliser de compte-rendu en double !
        console.log('[Jarvis CloudWorks] Tâche annulée par l\'utilisateur, compte-rendu vocal ignoré.');
        return;
      } else {
        vocalReport = outputText ? ("Une difficulté est survenue : " + outputText) : "Je n'ai pas pu terminer l'action demandée.";
      }

      window._jarvisState = 'answering';
      if (window.eva && window.eva.overlay) {
        window.eva.overlay.setState('speaking', vocalReport);
      }

      if (window.EVATTS && typeof window.EVATTS.speakTextStreaming === 'function') {
        window.EVATTS.speakTextStreaming(vocalReport, window.S ? window.S.config : {});
      }
    }
  });

  // Appelé à la fin de la réponse vocale d'EVA en mode Jarvis
  function handleJarvisFollowUp() {
    _clearJarvisThinkingWatchdog();
    if (!window._isJarvisActive) return;
    window._jarvisState = 'followup_prompt';

    // Choisir une question de relance aléatoire
    var q = FOLLOW_UP_PROMPTS[Math.floor(Math.random() * FOLLOW_UP_PROMPTS.length)];
    console.log('[Jarvis] Relance de suivi :', q);

    if (window.eva && window.eva.overlay) {
      window.eva.overlay.setState('speaking', q);
    }

    if (window.EVATTS && typeof window.EVATTS.speakText === 'function') {
      window.EVATTS.speakText(q, window.S ? window.S.config : {});
    }

    // Attendre que la voix TTS se termine réellement avant d'ouvrir le micro
    var checkTtsFinished = function() {
      if (window.EVATTS && typeof window.EVATTS.isSpeaking === 'function' && window.EVATTS.isSpeaking()) {
        setTimeout(checkTtsFinished, 150);
        return;
      }
      // Marge de 600ms après la parole pour dissiper la réverbération acoustique
      setTimeout(function() {
        if (!window._isJarvisActive) return;
        startJarvisListeningWindow();
      }, 600);
    };
    setTimeout(checkTtsFinished, 1000);
  }
  window.handleJarvisFollowUp = handleJarvisFollowUp;

  // Fenêtre d'écoute interactive de 7 secondes pour la réponse utilisateur
  function startJarvisListeningWindow() {
    if (!window._isJarvisActive) return;
    window._jarvisState = 'awaiting_followup';
    if (typeof window.evaResetWakeWordState === 'function') window.evaResetWakeWordState();
    console.log('[Jarvis] Début fenêtre écoute réponse utilisateur (7s)...');

    if (window.eva && window.eva.overlay) {
      window.eva.overlay.setState('listening', 'Autre chose ? (Dites "Non" pour quitter)');
    }

    window._jarvisListener = function(text, isFinal) {
      if (!text || !text.trim()) return false;
      var clean = text.trim();

      // Filtrer immédiatement l'écho de la question posée par EVA
      if (/(?:tout ce que je peux faire|faire pour vous|besoin d['’]autre|autre chose)/i.test(clean)) {
        return true;
      }
      // Filtrer si TTS était actif il y a moins de 700ms
      if (window._lastTtsEndTime && (Date.now() - window._lastTtsEndTime < 700)) {
        return true;
      }

      console.log('[Jarvis Follow-up Listener]', clean, 'final:', isFinal);

      // 1. Clôture de conversation
      if (CLOSING_REGEX.test(clean)) {
        if (_jarvisFollowUpTimer) { clearTimeout(_jarvisFollowUpTimer); _jarvisFollowUpTimer = null; }
        window._jarvisListener = null;
        window._jarvisState = 'closing';

        var bye = FAREWELL_PROMPTS[Math.floor(Math.random() * FAREWELL_PROMPTS.length)];
        if (window.eva && window.eva.overlay) {
          window.eva.overlay.setState('speaking', bye);
        }
        if (window.EVATTS && typeof window.EVATTS.speakText === 'function') {
          window.EVATTS.speakText(bye, window.S ? window.S.config : {});
        }

        setTimeout(function() {
          if (window.eva && window.eva.overlay) window.eva.overlay.hide();
          closeJarvisConversation();
        }, 2500);

        return true;
      }

      // 2. Nouvelle commande utilisateur
      if (clean.length > 2) {
        if (window.eva && window.eva.overlay) {
          window.eva.overlay.setState('listening', clean);
        }

        var doDispatchFollowUp = function() {
          if (_jarvisFollowUpTimer) { clearTimeout(_jarvisFollowUpTimer); _jarvisFollowUpTimer = null; }
          if (_jarvisFollowUpSilence) { clearTimeout(_jarvisFollowUpSilence); _jarvisFollowUpSilence = null; }
          window._jarvisListener = null;
          window._jarvisState = 'processing';

          console.log('[Jarvis Follow-up] Nouvelle consigne validée :', clean);
          updateJarvisConversationTitle(clean);
          if (window.eva && window.eva.overlay) {
            window.eva.overlay.setState('thinking', clean);
          }
          _submitWakeWordCommand(clean);
        };

        if (isFinal) {
          doDispatchFollowUp();
          return true;
        }

        if (_jarvisFollowUpSilence) clearTimeout(_jarvisFollowUpSilence);
        _jarvisFollowUpSilence = setTimeout(doDispatchFollowUp, 1100);
        return true;
      }

      return false;
    };

    if (_jarvisFollowUpTimer) clearTimeout(_jarvisFollowUpTimer);
    _jarvisFollowUpTimer = setTimeout(function() {
      console.log('[Jarvis] Timeout écoute follow-up (silence) -> fermeture overlay');
      window._jarvisListener = null;
      if (window._isJarvisActive && window.eva && window.eva.overlay) {
        window.eva.overlay.hide();
      }
      closeJarvisConversation();
    }, 7000);
  }
  window.startJarvisListeningWindow = startJarvisListeningWindow;

  /* ── Wake Word depuis l'overlay / Chat (application au premier plan) ── */
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
      } else if (action === 'cancel') {
        console.log('[PC Bridge] Action Annuler reçue depuis l\'overlay');
        _clearJarvisThinkingWatchdog();
        if (window._isVoiceInterrupting) return;
        window._isVoiceInterrupting = true;
        setTimeout(function() { window._isVoiceInterrupting = false; }, 3000);
        if (typeof window.cancelCurrentCloudWorksTask === 'function') {
          window.cancelCurrentCloudWorksTask();
        }
        if (typeof window.stopGeneration === 'function') {
          window.stopGeneration();
        }
        if (window.EVATTS && typeof window.EVATTS.stopTTS === 'function') {
          window.EVATTS.stopTTS();
        }
        if (window._isJarvisActive && typeof closeJarvisConversation === 'function') {
          closeJarvisConversation();
        }
      }
    });
  }

  function _submitWakeWordCommand(text) {
    if (!text || !text.trim()) return;
    var t = text.trim();
    if (window._isJarvisActive && typeof updateJarvisConversationTitle === 'function') {
      updateJarvisConversationTitle(t);
    }
    if (window.S) {
      window.S.busy = false;
      window.S.cwRunning = false;
    }
    if (typeof window.sendVoiceCommand === 'function') {
      window.sendVoiceCommand(t);
    } else if (typeof window.handleSend === 'function') {
      window.handleSend(t);
    } else {
      var input = document.getElementById('msgInput');
      if (input) {
        input.value = t;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      var sendBtn = document.getElementById('sendBtn');
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.click();
      }
    }
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
