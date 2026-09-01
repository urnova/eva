/* ═══════════════════════════════════════════════════
   PWA — capture de l'événement d'installation
═══════════════════════════════════════════════════ */
window._pwaPrompt = null;
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  window._pwaPrompt = e;
});

window._tutoInstallPWA = function(btn) {
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  if (window._pwaPrompt) {
    window._pwaPrompt.prompt();
    window._pwaPrompt.userChoice.then(function(r) {
      if (r.outcome === 'accepted') {
        if (btn) { btn.textContent = 'Installation lancée !'; btn.disabled = true; btn.style.opacity = '0.6'; }
        window._pwaPrompt = null;
      }
    });
  } else if (isIOS) {
    if (btn) {
      btn.innerHTML = '<!-- ios -->Safari : bouton <strong>Partager</strong> → <strong>Sur l\'écran d\'accueil</strong>';
      btn.style.fontSize = '0.75em';
      btn.style.color = 'rgba(255,255,255,0.6)';
      btn.style.borderColor = 'rgba(255,255,255,0.15)';
      btn.style.background = 'rgba(255,255,255,0.03)';
      btn.style.cursor = 'default';
    }
  } else {
    if (btn) {
      btn.textContent = 'Déjà installée ou navigateur incompatible';
      btn.style.opacity = '0.5';
      btn.style.cursor = 'default';
    }
  }
};

/* ═══════════════════════════════════════════════════
   TUTORIAL — première visite par appareil (v2 rich)
═══════════════════════════════════════════════════ */
(function(){
  var TUTO_KEY = 'eva_tutorial_done_v1';

  /* ── Visuals: mini-maquettes CSS animées ─────────── */

  function _tutoSvg(w, h, paths, col) {
    var c = col || 'var(--cyan)';
    return '<svg viewBox="0 0 24 24" style="width:'+w+'px;height:'+h+'px;stroke:'+c+';fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;">'+paths+'</svg>';
  }

  /* Étape 1 — Bienvenue : logo EVA animé */
  function visWelcome() {
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;">' +
      '<img src="/assets/images/eva-logo.png" alt="EVA" style="width:68px;height:auto;animation:tutoLogoPulse 3s ease-in-out infinite;">' +
      '<div style="font-size:0.52em;letter-spacing:3px;color:var(--cyan);font-family:\'Orbitron\',monospace;opacity:0.85;animation:tmFadeSlide 0.6s ease 0.3s both;">ASTRAL TECHNOLOGIE</div>' +
      '</div>';
  }

  /* Étape 2 — En-tête du chat : mockup avec boutons étiquetés */
  function visHeader() {
    return '<div style="width:100%;background:#0d0f1a;border:1px solid rgba(123,139,245,0.15);border-radius:10px;overflow:hidden;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,0.05);">' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
          '<div style="display:flex;flex-direction:column;gap:2.5px;width:16px;">' +
            '<div style="height:1.5px;background:rgba(255,255,255,0.35);border-radius:1px;"></div>' +
            '<div style="height:1.5px;background:rgba(255,255,255,0.35);border-radius:1px;"></div>' +
            '<div style="height:1.5px;background:rgba(255,255,255,0.35);border-radius:1px;"></div>' +
          '</div>' +
          '<span style="font-size:0.52em;color:rgba(255,255,255,0.25);font-family:\'Orbitron\',monospace;">Nouvelle conversation</span>' +
        '</div>' +
        '<div style="display:flex;align-items:flex-end;gap:7px;">' +
          /* EN LIGNE + skip */
          '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">' +
            '<div style="display:flex;align-items:center;gap:3px;padding:3px 6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;">' +
              '<div style="width:5px;height:5px;border-radius:50%;background:#22c55e;animation:tmDotBlink 2s ease-in-out infinite;flex-shrink:0;"></div>' +
              '<span style="font-size:0.44em;color:rgba(255,255,255,0.4);letter-spacing:0.8px;">EN LIGNE</span>' +
              '<div style="width:14px;height:14px;border-radius:4px;background:rgba(123,139,245,0.12);border:1px solid rgba(123,139,245,0.3);display:flex;align-items:center;justify-content:center;animation:tmGlowBorder 2s ease-in-out infinite;">'+_tutoSvg(8,8,'<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>')+'</div>' +
            '</div>' +
            '<span style="font-size:0.4em;color:rgba(123,139,245,0.55);text-align:center;line-height:1.3;">Stoppe la voix<br>d\'EVA</span>' +
          '</div>' +
          /* Wake word */
          '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">' +
            '<div style="width:26px;height:26px;border-radius:7px;background:rgba(123,139,245,0.1);border:1px solid rgba(123,139,245,0.4);display:flex;align-items:center;justify-content:center;animation:tmGlowBorder 1.8s ease-in-out infinite;">'+_tutoSvg(13,13,'<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>')+'</div>' +
            '<span style="font-size:0.4em;color:rgba(123,139,245,0.55);text-align:center;line-height:1.3;">Wake<br>Word</span>' +
          '</div>' +
          /* TTS mute */
          '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">' +
            '<div style="width:26px;height:26px;border-radius:7px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;">'+_tutoSvg(13,13,'<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>','rgba(255,255,255,0.4)')+'</div>' +
            '<span style="font-size:0.4em;color:rgba(255,255,255,0.3);text-align:center;line-height:1.3;">Mute /<br>Voix</span>' +
          '</div>' +
          /* EVA button */
          '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">' +
            '<div style="display:flex;align-items:center;gap:3px;padding:4px 8px;border-radius:7px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);font-size:0.55em;color:rgba(255,255,255,0.45);">'+_tutoSvg(10,10,'<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>','rgba(255,255,255,0.4)')+' EVA</div>' +
            '<span style="font-size:0.4em;color:rgba(255,255,255,0.3);text-align:center;line-height:1.3;">Cache /<br>Affiche avatar</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* Étape 3 — Wake Word : bouton allumé + waveform */
  function visWakeWord() {
    var bars = '';
    var delays = [0,0.1,0.2,0.3,0.4,0.35,0.25,0.15,0.05];
    delays.forEach(function(d){
      bars += '<div style="width:3.5px;background:linear-gradient(to top,var(--cyan),#7c5cff);border-radius:2px;animation:tmWave 0.85s ease-in-out infinite;animation-delay:'+d+'s;min-height:5px;"></div>';
    });
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;">' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<div style="width:38px;height:38px;border-radius:11px;background:rgba(123,139,245,0.14);border:1.5px solid rgba(123,139,245,0.6);display:flex;align-items:center;justify-content:center;animation:tmGlowBorder 1.2s ease-in-out infinite;">'+_tutoSvg(18,18,'<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>')+'</div>' +
        '<div style="font-size:0.6em;color:var(--cyan);font-family:\'Orbitron\',monospace;letter-spacing:2px;animation:tmDotBlink 1.5s ease-in-out infinite;">ACTIF</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:3px;height:38px;">'+bars+'</div>' +
      '<div style="font-size:0.58em;color:rgba(123,139,245,0.55);letter-spacing:1px;">en écoute continue...</div>' +
    '</div>';
  }

  /* Étape 4 — Sidebar : menu latéral animé */
  function visSidebar() {
    var navItems = [
      {icon:_tutoSvg(10,10,'<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>'), label:'Notes'},
      {icon:_tutoSvg(10,10,'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="m4 5 1.5 1.5M20 5l-1.5 1.5"/>'), label:'Alarmes'},
      {icon:_tutoSvg(10,10,'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'), label:'Rappels'},
      {icon:_tutoSvg(10,10,'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'), label:'Agenda'},
    ];
    var rows = navItems.map(function(it, i) {
      return '<div style="display:flex;align-items:center;gap:7px;padding:5px 10px;background:rgba(123,139,245,0.07);border-left:2px solid rgba(123,139,245,0.45);margin-bottom:2px;animation:tmFadeSlide 0.35s ease both;animation-delay:'+(i*0.1)+'s;">' +
        it.icon +
        '<span style="font-size:0.58em;color:var(--cyan);font-weight:600;">'+it.label+'</span>' +
      '</div>';
    }).join('');
    return '<div style="background:#0d0f1a;border:1px solid rgba(123,139,245,0.12);border-radius:10px;overflow:hidden;min-width:170px;">' +
      '<div style="padding:5px 10px;font-size:0.44em;letter-spacing:2px;color:rgba(255,255,255,0.18);border-bottom:1px solid rgba(255,255,255,0.05);">MENU LATÉRAL</div>' +
      rows +
      '<div style="padding:4px 10px;font-size:0.47em;color:rgba(255,255,255,0.2);border-top:1px solid rgba(255,255,255,0.05);margin-top:2px;">Conversations passées...</div>' +
      '<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-top:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02);">' +
        '<div style="width:22px;height:22px;border-radius:50%;background:rgba(123,139,245,0.18);display:flex;align-items:center;justify-content:center;font-size:0.6em;color:var(--cyan);">U</div>' +
        '<span style="font-size:0.5em;color:rgba(255,255,255,0.3);flex:1;">Mon profil</span>' +
        _tutoSvg(10,10,'<circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M5 5l4.24 4.24m5.52 5.52L19 19M1 12h6m6 0h6M5 19l4.24-4.24m5.52-5.52L19 5"') +
      '</div>' +
    '</div>';
  }

  /* Étape 5 — Tons : barre de sélection de ton */
  function visTones() {
    var tones = [
      {label:'Pro', active:true},
      {label:'Amical', active:false},
      {label:'Créatif', active:false},
      {label:'Code', active:false},
    ];
    var btns = tones.map(function(t) {
      if (t.active) return '<div style="padding:6px 11px;border-radius:7px;font-size:0.58em;font-weight:700;background:rgba(123,139,245,0.15);border:1px solid rgba(123,139,245,0.5);color:var(--cyan);animation:tmGlowBorder 2s ease-in-out infinite;">'+t.label+'</div>';
      return '<div style="padding:6px 11px;border-radius:7px;font-size:0.58em;font-weight:500;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);color:rgba(255,255,255,0.3);">'+t.label+'</div>';
    }).join('');
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;">' +
      '<div style="font-size:0.52em;color:rgba(255,255,255,0.25);letter-spacing:1px;">Barre de ton — sous la zone de saisie</div>' +
      '<div style="display:flex;gap:5px;padding:7px 10px;background:#0d0f1a;border:1px solid rgba(123,139,245,0.12);border-radius:10px;">' +
        btns +
      '</div>' +
      '<div style="font-size:0.52em;color:rgba(123,139,245,0.5);">← Cliquez pour changer le style</div>' +
    '</div>';
  }

  /* Étape 6 — Actions : conversation avec création auto */
  function visActions() {
    return '<div style="background:#0d0f1a;border:1px solid rgba(123,139,245,0.12);border-radius:10px;overflow:hidden;width:100%;">' +
      '<div style="display:flex;justify-content:flex-end;padding:8px 10px 4px;">' +
        '<div style="background:rgba(123,139,245,0.1);border:1px solid rgba(123,139,245,0.2);border-radius:10px 10px 2px 10px;padding:5px 9px;font-size:0.55em;color:rgba(255,255,255,0.8);max-width:78%;line-height:1.4;">' +
          'Eva, rappelle-moi d\'appeler le médecin demain à 10h' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-start;padding:4px 10px 8px;">' +
        '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px 10px 10px 2px;padding:5px 9px;font-size:0.55em;color:rgba(255,255,255,0.55);max-width:82%;line-height:1.4;">' +
          'Bien sûr, c\'est noté !' +
          '<div style="margin-top:5px;padding:5px 8px;background:rgba(123,139,245,0.08);border:1px solid rgba(123,139,245,0.25);border-radius:6px;color:var(--cyan);font-size:0.95em;font-weight:600;animation:tmFadeSlide 0.5s ease 0.4s both;display:flex;align-items:center;gap:5px;">'+_tutoSvg(10,10,'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>')+'Rappel créé · demain 10h00</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* Étape 7 — Paramètres : carte user + sections */
  function visSettings() {
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;">' +
      '<div style="font-size:0.5em;color:rgba(255,255,255,0.2);letter-spacing:1px;">En bas du menu latéral ↓</div>' +
      '<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:#0d0f1a;border:1.5px solid rgba(123,139,245,0.2);border-radius:10px;width:220px;animation:tmGlowBorder 2s ease-in-out infinite;">' +
        '<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,rgba(123,139,245,0.25),rgba(124,92,255,0.25));display:flex;align-items:center;justify-content:center;font-size:0.7em;color:var(--cyan);font-weight:700;">U</div>' +
        '<div style="flex:1;">' +
          '<div style="font-size:0.58em;color:rgba(255,255,255,0.65);font-weight:600;">Mon profil</div>' +
          '<div style="font-size:0.47em;color:rgba(123,139,245,0.6);">Utilisateur</div>' +
        '</div>' +
        '<div style="animation:tmSpin 4s linear infinite;">'+_tutoSvg(12,12,'<circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M5 5l4.24 4.24m5.52 5.52L19 19M1 12h6m6 0h6M5 19l4.24-4.24m5.52-5.52L19 5"','rgba(255,255,255,0.4)')+'</div>' +
      '</div>' +
      '<div style="display:flex;gap:5px;animation:tmFadeSlide 0.5s ease 0.3s both;">' +
        '<div style="padding:4px 9px;background:rgba(123,139,245,0.1);border:1px solid rgba(123,139,245,0.3);border-radius:6px;font-size:0.5em;color:var(--cyan);display:flex;align-items:center;gap:4px;">'+_tutoSvg(8,8,'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>')+'IA</div>' +
        '<div style="padding:4px 9px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:6px;font-size:0.5em;color:rgba(255,255,255,0.35);display:flex;align-items:center;gap:4px;">'+_tutoSvg(8,8,'<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>','rgba(255,255,255,0.35)')+'Voix</div>' +
        '<div style="padding:4px 9px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:6px;font-size:0.5em;color:rgba(255,255,255,0.35);display:flex;align-items:center;gap:4px;">'+_tutoSvg(8,8,'<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>','rgba(255,255,255,0.35)')+'Avatar</div>' +
        '<div style="padding:4px 9px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:6px;font-size:0.5em;color:rgba(255,255,255,0.35);display:flex;align-items:center;gap:4px;">'+_tutoSvg(8,8,'<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>','rgba(255,255,255,0.35)')+'Profil</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Définition des étapes ───────────────────────── */
  /* Étape Install PC — bureau avec popup d'installation */
  function visInstallPC() {
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;">' +
      /* Badge */
      '<div style="display:flex;align-items:center;gap:5px;padding:3px 10px;background:rgba(123,139,245,0.12);border:1px solid rgba(123,139,245,0.4);border-radius:20px;animation:tmFadeSlide 0.4s ease both;">' +
        _tutoSvg(9,9,'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>') +
        '<span style="font-size:0.5em;color:var(--cyan);font-weight:700;letter-spacing:1px;">APPLICATION BUREAU</span>' +
      '</div>' +
      /* Fenêtre navigateur */
      '<div style="width:210px;background:#0d0f1a;border:1px solid rgba(123,139,245,0.18);border-radius:10px;overflow:hidden;">' +
        /* Barre d'adresse */
        '<div style="display:flex;align-items:center;gap:5px;padding:5px 8px;background:#0a0c18;border-bottom:1px solid rgba(255,255,255,0.06);">' +
          '<div style="display:flex;gap:3px;"><div style="width:5px;height:5px;border-radius:50%;background:rgba(255,80,80,0.5);"></div><div style="width:5px;height:5px;border-radius:50%;background:rgba(255,200,80,0.5);"></div><div style="width:5px;height:5px;border-radius:50%;background:rgba(80,220,80,0.5);"></div></div>' +
          '<div style="flex:1;background:rgba(255,255,255,0.05);border-radius:4px;padding:2px 6px;font-size:6px;color:rgba(255,255,255,0.35);display:flex;align-items:center;gap:3px;">'+_tutoSvg(6,6,'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>','rgba(255,255,255,0.3)')+'eva.app/chat</div>' +
          /* Bouton install glow */
          '<div style="width:16px;height:16px;border-radius:4px;background:rgba(123,139,245,0.2);border:1.5px solid var(--cyan);display:flex;align-items:center;justify-content:center;animation:tmGlowBorder 1.2s ease-in-out infinite;flex-shrink:0;">'+_tutoSvg(9,9,'<path d="M12 5v10M8 15l4 4 4-4"/>','var(--cyan)')+'</div>' +
        '</div>' +
        /* Contenu + popup install */
        '<div style="position:relative;height:72px;background:rgba(6,13,26,0.9);display:flex;align-items:center;justify-content:center;">' +
          '<div style="font-size:7px;color:rgba(255,255,255,0.12);letter-spacing:2px;">CHAT</div>' +
          /* Popup install */
          '<div style="position:absolute;top:8px;right:6px;width:90px;background:#111827;border:1px solid rgba(123,139,245,0.4);border-radius:7px;padding:7px 8px;animation:tmFadeSlide 0.5s ease 0.3s both;box-shadow:0 4px 20px rgba(123,139,245,0.15);">' +
            '<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px;">' +
              '<img src="/assets/images/eva-logo.svg" style="width:14px;height:14px;">' +
              '<div><div style="font-size:6px;font-weight:700;color:#fff;">E.V.A</div><div style="font-size:5px;color:rgba(255,255,255,0.35);">eva.app</div></div>' +
            '</div>' +
            '<div style="height:1px;background:rgba(255,255,255,0.06);margin-bottom:5px;"></div>' +
            '<div style="display:flex;gap:3px;">' +
              '<div style="flex:1;padding:3px 0;text-align:center;background:rgba(123,139,245,0.2);border:1px solid rgba(123,139,245,0.5);border-radius:4px;font-size:5.5px;color:var(--cyan);font-weight:700;">Installer</div>' +
              '<div style="padding:3px 5px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:4px;font-size:5.5px;color:rgba(255,255,255,0.3);">✕</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  var STEPS_PC = [
    {
      visual: visWelcome,
      title: 'Bienvenue sur E.V.A !',
      desc: '<strong>E.V.A</strong> (Evolutionary Virtual Assistant) est votre assistante IA personnelle nouvelle génération, développée par <strong style="color:var(--cyan)">Astral Technologie</strong>.<br><br>Ce tutoriel vous explique comment en tirer le meilleur parti.',
      tip: null
    },
    {
      visual: visHeader,
      title: 'La barre d\'en-tête',
      desc: 'En haut à <strong>droite</strong> du chat, 4 boutons essentiels :<br>' +
        '• <strong>EN LIGNE + Passer</strong> — coupe immédiatement la voix d\'EVA quand elle parle<br>' +
        '• Icône micro — active/désactive le <em>Wake Word</em><br>' +
        '• Icône son — mute ou active la synthèse vocale<br>' +
        '• <strong>EVA</strong> — cache ou affiche l\'orbe holographique',
      tip: null
    },
    {
      visual: visWakeWord,
      title: 'Wake Word "Eva,"',
      desc: 'Dites <strong>"Eva,"</strong> (avec la virgule) pour activer EVA à la voix sans toucher l\'écran.<br><br>Cliquez sur le bouton micro en haut à droite pour activer ce mode — il devient <span style="color:var(--cyan)">cyan</span> quand il est en écoute active.<br><br>Après votre commande, EVA répond <strong>automatiquement à voix haute</strong>.',
      tip: 'Astuce : dites "Eva, crée une note", "Eva, quel temps fait-il ?" — tout fonctionne !'
    },
    {
      visual: visSidebar,
      title: 'Le menu latéral',
      desc: 'Cliquez sur le bouton menu (en haut à gauche sur mobile, toujours visible sur ordinateur) pour ouvrir le menu :<br>' +
        '• <strong>Notes · Alarmes · Rappels · Agenda</strong><br>' +
        '• <strong>Conversations</strong> — retrouvez vos échanges passés<br>' +
        '• <strong>Profil</strong> — en bas du menu, cliquez sur votre nom',
      tip: 'La barre de recherche en haut du menu retrouve n\'importe quelle conversation passée.'
    },
    {
      visual: visTones,
      title: 'Les tons de réponse',
      desc: 'Juste <strong>sous la zone de saisie</strong>, 4 tons changent le style des réponses d\'EVA :<br>' +
        '• <strong>Pro</strong> — formel, précis, professionnel<br>' +
        '• <strong>Amical</strong> — détendu, naturel, chaleureux<br>' +
        '• <strong>Créatif</strong> — imaginatif, littéraire, poétique<br>' +
        '• <strong>Code</strong> — mode développeur, syntaxe, snippets',
      tip: 'Le ton est conservé pour toute la conversation, changez-le à tout moment.'
    },

    {
      visual: visActions,
      title: 'Raccourcis rapides & Actions',
      desc: 'En bas de la zone de chat, la rangée de raccourcis rapides :<br>' +
        '• <strong>Note</strong> · <strong>Alarme</strong> · <strong>Agenda</strong> · <strong>Résumé</strong><br><br>' +
        'EVA crée vos éléments <strong>automatiquement</strong> en langage naturel :<br>' +
        '• <em>"Eva, rappelle-moi d\'appeler le médecin demain à 10h"</em><br>' +
        '• <em>"Crée une alarme à 7h demain matin"</em><br>' +
        '• <em>"Ajoute un événement anniversaire le 15 avril"</em>',
      tip: 'Retrouvez toutes vos notes, alarmes et événements dans le menu latéral à gauche.'
    },
    {
      visual: visSettings,
      title: 'Paramètres & Personnalisation',
      desc: 'Cliquez sur <strong>votre nom en bas du menu</strong> pour accéder aux paramètres :<br>' +
        '• <strong>IA</strong> — choisir le fournisseur (OpenAI, Claude, Puter…) et la clé API<br>' +
        '• <strong>Voix</strong> — activer/désactiver et configurer la voix d\'EVA<br>' +
        '• <strong>Orbe</strong> — activer/désactiver l\'orbe holographique d\'E.V.A<br>' +
        '• <strong>Profil</strong> — modifier votre nom et préférences',
      tip: 'Pendant qu\'EVA parle, le bouton Passer dans l\'en-tête coupe sa voix immédiatement.'
    },
    {
      visual: visInstallPC,
      title: 'Installer E.V.A sur votre ordinateur',
      desc: 'Accédez à E.V.A directement depuis votre <strong>bureau</strong>, sans ouvrir de navigateur.<br><br>Elle s\'ouvre en <strong>plein écran</strong>, reste dans votre barre des tâches et démarre en un clic — comme une vraie application.<br><br>' +
        '<button onclick="window._tutoInstallPWA(this)" style="margin-top:4px;width:100%;padding:9px 14px;background:linear-gradient(135deg,rgba(123,139,245,0.18),rgba(123,139,245,0.06));border:1.5px solid rgba(123,139,245,0.55);border-radius:10px;color:var(--cyan);font-weight:700;font-size:0.88em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;transition:all 0.2s;"><svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:var(--cyan);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;"><path d="M12 5v10M8 15l4 4 4-4"/><path d="M3 19h18"/></svg>Installer E.V.A sur cet ordinateur</button>',
      tip: 'Si le bouton est grisé, E.V.A est peut-être déjà installée — vérifiez votre barre des tâches !'
    }
  ];

  /* ═══ VISUELS MOBILE-SPÉCIFIQUES ═══ */

  /* Mobile step 1 — Welcome mobile */
  function visMobileWelcome() {
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;">' +
      '<img src="/assets/images/eva-logo.png" alt="EVA" style="width:62px;height:auto;animation:tutoLogoPulse 3s ease-in-out infinite;">' +
      '<div style="font-size:0.52em;letter-spacing:3px;color:var(--cyan);font-family:\'Orbitron\',monospace;opacity:0.85;">ASTRAL TECHNOLOGIE</div>' +
      '<div style="display:flex;align-items:center;gap:6px;padding:4px 10px;background:rgba(123,139,245,0.1);border:1px solid rgba(123,139,245,0.35);border-radius:20px;animation:tmFadeSlide 0.5s ease 0.4s both;">' +
        _tutoSvg(10,10,'<rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1" fill="var(--cyan)" stroke="none"/>') +
        '<span style="font-size:0.52em;color:var(--cyan);font-weight:700;letter-spacing:1px;">VERSION MOBILE</span>' +
      '</div>' +
    '</div>';
  }

  /* Mobile step 2 — Interface de chat mobile */
  function visMobileChat() {
    return '<div style="width:180px;background:#0d0f1a;border:1px solid rgba(123,139,245,0.18);border-radius:14px;overflow:hidden;font-size:1px;">' +
      /* Header */
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.06);">' +
        '<div style="display:flex;flex-direction:column;gap:2px;">' +
          '<div style="height:1.5px;width:14px;background:rgba(255,255,255,0.4);border-radius:1px;"></div>' +
          '<div style="height:1.5px;width:14px;background:rgba(255,255,255,0.4);border-radius:1px;"></div>' +
          '<div style="height:1.5px;width:14px;background:rgba(255,255,255,0.4);border-radius:1px;"></div>' +
        '</div>' +
        '<span style="font-size:8px;color:rgba(255,255,255,0.25);font-family:\'Orbitron\',monospace;letter-spacing:1px;">E.V.A</span>' +
        '<div style="display:flex;gap:4px;">' +
          _tutoSvg(9,9,'<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>') +
          _tutoSvg(9,9,'<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>','rgba(255,255,255,0.3)') +
        '</div>' +
      '</div>' +
      /* Chat area */
      '<div style="padding:8px 8px 4px;display:flex;flex-direction:column;gap:5px;">' +
        '<div style="display:flex;justify-content:flex-start;">' +
          '<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:8px 8px 8px 2px;padding:5px 8px;font-size:7px;color:rgba(255,255,255,0.6);max-width:78%;line-height:1.4;">Bonjour ! Comment puis-je vous aider ?</div>' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end;">' +
          '<div style="background:linear-gradient(135deg,rgba(123,139,245,0.2),rgba(124,92,255,0.2));border:1px solid rgba(123,139,245,0.25);border-radius:8px 8px 2px 8px;padding:5px 8px;font-size:7px;color:var(--text-msg);max-width:72%;line-height:1.4;">Rappelle-moi d\'acheter du lait</div>' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-start;">' +
          '<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(123,139,245,0.2);border-radius:8px 8px 8px 2px;padding:5px 8px;font-size:7px;color:rgba(255,255,255,0.6);max-width:78%;line-height:1.4;animation:tmFadeSlide 0.4s ease 0.3s both;">Bien sûr ! Rappel créé.</div>' +
        '</div>' +
      '</div>' +
      /* Input bar */
      '<div style="display:flex;align-items:center;gap:5px;padding:6px 8px;border-top:1px solid rgba(255,255,255,0.06);">' +
        '<div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:5px 9px;font-size:7px;color:rgba(255,255,255,0.2);">Taper ou parler…</div>' +
        '<div style="width:22px;height:22px;border-radius:50%;background:rgba(123,139,245,0.2);border:1px solid rgba(123,139,245,0.4);display:flex;align-items:center;justify-content:center;animation:tmGlowBorder 2s ease-in-out infinite;">'+_tutoSvg(10,10,'<polygon points="22 2 11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>')+'</div>' +
      '</div>' +
    '</div>';
  }

  /* Mobile step 3 — Voix sur mobile */
  function visMobileVoice() {
    var bars = '';
    [0,0.12,0.25,0.38,0.5,0.38,0.25,0.12,0].forEach(function(d){
      bars += '<div style="width:3px;background:linear-gradient(to top,var(--cyan),#7c5cff);border-radius:2px;animation:tmWave 0.85s ease-in-out infinite;animation-delay:'+d+'s;min-height:4px;"></div>';
    });
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;">' +
      /* Phone outline with mic button */
      '<div style="position:relative;width:52px;height:90px;border:2px solid rgba(255,255,255,0.15);border-radius:10px;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">' +
        '<div style="position:absolute;top:5px;left:50%;transform:translateX(-50%);width:14px;height:2px;background:rgba(255,255,255,0.15);border-radius:1px;"></div>' +
        '<div style="width:36px;height:36px;border-radius:50%;background:rgba(123,139,245,0.15);border:2px solid rgba(123,139,245,0.6);display:flex;align-items:center;justify-content:center;animation:tmGlowBorder 1.2s ease-in-out infinite;">'+_tutoSvg(16,16,'<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>')+'</div>' +
        '<div style="position:absolute;bottom:5px;left:50%;transform:translateX(-50%);width:10px;height:10px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.2);"></div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:2px;height:28px;">'+bars+'</div>' +
      '<div style="font-size:0.52em;color:rgba(123,139,245,0.7);letter-spacing:1px;font-weight:600;">EN ÉCOUTE...</div>' +
    '</div>';
  }

  /* Mobile step 4 — Menu hamburger sur mobile */
  function visMobileMenu() {
    return '<div style="display:flex;gap:10px;align-items:flex-start;">' +
      /* Phone with hamburger highlighted */
      '<div style="width:90px;height:130px;background:#0d0f1a;border:1px solid rgba(123,139,245,0.18);border-radius:12px;overflow:hidden;flex-shrink:0;">' +
        '<div style="display:flex;align-items:center;padding:7px 8px;border-bottom:1px solid rgba(255,255,255,0.06);">' +
          '<div style="padding:3px 5px;background:rgba(123,139,245,0.15);border:1.5px solid rgba(123,139,245,0.6);border-radius:5px;animation:tmGlowBorder 1.5s ease-in-out infinite;display:flex;flex-direction:column;gap:2px;cursor:pointer;">' +
            '<div style="height:1.5px;width:10px;background:var(--cyan);border-radius:1px;"></div>' +
            '<div style="height:1.5px;width:10px;background:var(--cyan);border-radius:1px;"></div>' +
            '<div style="height:1.5px;width:10px;background:var(--cyan);border-radius:1px;"></div>' +
          '</div>' +
          '<span style="flex:1;text-align:center;font-size:7px;color:rgba(255,255,255,0.2);font-family:\'Orbitron\',monospace;">E.V.A</span>' +
        '</div>' +
        '<div style="padding:6px 8px;font-size:7px;color:rgba(255,255,255,0.2);">Chat avec EVA...</div>' +
      '</div>' +
      /* Arrow + panel */
      '<div style="display:flex;flex-direction:column;align-items:flex-start;gap:5px;padding-top:10px;">' +
        '<div style="display:flex;align-items:center;gap:3px;font-size:8px;color:var(--cyan);font-weight:700;animation:tmDotBlink 1.5s ease-in-out infinite;">'+_tutoSvg(8,8,'<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>')+'Appuyez ici</div>' +
        '<div style="background:#111827;border:1px solid rgba(123,139,245,0.2);border-radius:8px;padding:5px 0;width:100px;animation:tmFadeSlide 0.4s ease 0.3s both;">' +
          ['Notes','Alarmes','Rappels','Agenda'].map(function(label, i){
            var icons = ['<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>','<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/>','<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>','<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'];
            return '<div style="display:flex;align-items:center;gap:5px;padding:3px 8px;animation:tmFadeSlide 0.3s ease '+(i*0.08)+'s both;">' +
              _tutoSvg(8,8,icons[i]) +
              '<span style="font-size:7px;color:var(--cyan);font-weight:600;">'+label+'</span>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* Mobile step 5 — Modules en vue mobile */
  function visMobileModules() {
    var items = [
      {icon:'<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>',title:'Réunion lundi',sub:'Apporter le contrat',color:'rgba(123,139,245,0.15)',border:'rgba(123,139,245,0.3)'},
      {icon:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="m4 5 1.5 1.5M20 5l-1.5 1.5"/>',title:'Alarme 07:30',sub:'Demain matin',color:'rgba(124,92,255,0.15)',border:'rgba(124,92,255,0.3)'},
      {icon:'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',title:'Rappel 18h00',sub:'Appeler le médecin',color:'rgba(34,197,94,0.1)',border:'rgba(34,197,94,0.25)'},
    ];
    return '<div style="display:flex;flex-direction:column;gap:6px;width:195px;">' +
      items.map(function(it,i){
        return '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:'+it.color+';border:1px solid '+it.border+';border-radius:10px;animation:tmFadeSlide 0.35s ease '+(i*0.12)+'s both;">' +
          '<div style="width:22px;height:22px;border-radius:7px;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+_tutoSvg(11,11,it.icon)+'</div>' +
          '<div style="min-width:0;">' +
            '<div style="font-size:8px;color:var(--text);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+it.title+'</div>' +
            '<div style="font-size:7px;color:rgba(255,255,255,0.4);margin-top:1px;">'+it.sub+'</div>' +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  /* Mobile Install — téléphone avec bannière d'installation */
  function visInstallMobile() {
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;">' +
      /* Badge */
      '<div style="display:flex;align-items:center;gap:5px;padding:3px 10px;background:rgba(123,139,245,0.12);border:1px solid rgba(123,139,245,0.4);border-radius:20px;animation:tmFadeSlide 0.4s ease both;">' +
        _tutoSvg(9,9,'<rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1" fill="var(--cyan)" stroke="none"/>') +
        '<span style="font-size:0.5em;color:var(--cyan);font-weight:700;letter-spacing:1px;">APPLICATION MOBILE</span>' +
      '</div>' +
      /* Téléphone */
      '<div style="width:110px;background:#060d1a;border:1.5px solid rgba(123,139,245,0.18);border-radius:18px;overflow:hidden;position:relative;">' +
        /* Caméra */
        '<div style="height:14px;display:flex;align-items:center;justify-content:center;background:#0a0c18;">' +
          '<div style="width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.12);"></div>' +
        '</div>' +
        /* Écran */
        '<div style="padding:8px 8px 0;background:#060d1a;">' +
          '<div style="height:50px;display:flex;align-items:center;justify-content:center;background:rgba(123,139,245,0.03);border:1px solid rgba(123,139,245,0.08);border-radius:8px;">' +
            '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;">' +
              '<img src="/assets/images/eva-logo.svg" style="width:18px;height:18px;opacity:0.5;">' +
              '<div style="font-size:5px;color:rgba(255,255,255,0.2);letter-spacing:1px;">CHAT</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        /* Bannière install Chrome-like */
        '<div style="margin:6px 6px 0;padding:6px 8px;background:#111827;border:1px solid rgba(123,139,245,0.45);border-radius:8px;animation:tmFadeSlide 0.5s ease 0.3s both;box-shadow:0 -2px 12px rgba(123,139,245,0.12);">' +
          '<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px;">' +
            '<img src="/assets/images/eva-logo.svg" style="width:12px;height:12px;">' +
            '<div style="font-size:6px;font-weight:700;color:#fff;flex:1;">Installer E.V.A</div>' +
            '<div style="font-size:5px;color:rgba(255,255,255,0.35);">eva.app</div>' +
          '</div>' +
          '<div style="width:100%;padding:3px 0;text-align:center;background:rgba(123,139,245,0.22);border:1px solid rgba(123,139,245,0.5);border-radius:5px;font-size:6px;color:var(--cyan);font-weight:700;animation:tmGlowBorder 1.4s ease-in-out infinite;">Ajouter</div>' +
        '</div>' +
        /* Barre home */
        '<div style="height:14px;display:flex;align-items:center;justify-content:center;">' +
          '<div style="width:28px;height:3px;border-radius:2px;background:rgba(255,255,255,0.15);"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ═══ STEPS MOBILE ═══ */
  var STEPS_MOBILE = [
    {
      visual: visMobileWelcome,
      title: 'E.V.A sur mobile',
      desc: '<strong>E.V.A</strong> est votre assistante IA personnelle, conçue par <strong style="color:var(--cyan)">Astral Technologie</strong>.<br><br>Ce tutoriel est <strong>optimisé pour votre téléphone</strong> — gestes tactiles, voix mains libres, interface adaptée.',
      tip: null
    },
    {
      visual: visMobileChat,
      title: 'Écrire à EVA',
      desc: 'Appuyez sur la <strong>zone de saisie en bas</strong> pour ouvrir le clavier et écrire votre message.<br><br>Appuyez sur le bouton d\'envoi <strong>→</strong> pour envoyer — ou utilisez la voix (étape suivante).',
      tip: 'L\'historique de votre conversation s\'affiche en défilant vers le haut.'
    },
    {
      visual: visMobileVoice,
      title: 'Voix — Mains libres',
      desc: 'Dites <strong>"Eva,"</strong> (avec une virgule) pour activer EVA sans toucher l\'écran.<br><br>Le bouton micro en haut à droite devient <span style="color:var(--cyan)">cyan</span> — EVA vous écoute et vous répond à voix haute automatiquement.',
      tip: 'Idéal en cuisine, au volant ou quand vos mains sont occupées !'
    },
    {
      visual: visMobileMenu,
      title: 'Menu latéral',
      desc: 'Appuyez sur <strong>le bouton ≡ en haut à gauche</strong> pour ouvrir le menu — il glisse depuis la gauche.<br><br>Vous y trouvez vos <strong>Notes, Alarmes, Rappels et Agenda</strong>, ainsi que l\'historique de vos conversations.',
      tip: 'Balayez vers la gauche sur le menu ou appuyez à l\'extérieur pour le refermer.'
    },
    {
      visual: visMobileModules,
      title: 'Notes, Alarmes & Rappels',
      desc: 'Demandez à EVA en langage naturel, elle crée tout automatiquement :<br>' +
        '• <em>"Rappelle-moi d\'appeler le médecin à 18h"</em><br>' +
        '• <em>"Alarme à 7h30 demain"</em><br>' +
        '• <em>"Note : réunion lundi, apporter le contrat"</em><br><br>' +
        'Retrouvez tout depuis le menu ≡.',
      tip: null
    },
    {
      visual: visSettings,
      title: 'Paramètres & Personnalisation',
      desc: 'Ouvrez le menu ≡ et appuyez sur <strong>votre nom tout en bas</strong> pour accéder aux réglages :<br>' +
        '• <strong>IA</strong> — choisir le moteur (Puter, OpenAI, Claude…)<br>' +
        '• <strong>Voix</strong> — activer/désactiver et choisir la voix d\'EVA<br>' +
        '• <strong>Profil</strong> — votre nom et préférences',
      tip: 'Pendant qu\'EVA parle, le bouton Passer en haut coupe sa voix immédiatement.'
    },
    {
      visual: visInstallMobile,
      title: 'Installer E.V.A sur votre téléphone',
      desc: 'Ajoutez E.V.A directement sur l\'<strong>écran d\'accueil</strong> de votre téléphone.<br><br>Elle s\'ouvre <strong>plein écran</strong>, sans barre d\'URL, comme une vraie application — toujours à portée d\'un tap.<br><br>' +
        '<button onclick="window._tutoInstallPWA(this)" style="margin-top:4px;width:100%;padding:9px 14px;background:linear-gradient(135deg,rgba(123,139,245,0.18),rgba(123,139,245,0.06));border:1.5px solid rgba(123,139,245,0.55);border-radius:10px;color:var(--cyan);font-weight:700;font-size:0.88em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;transition:all 0.2s;"><svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:var(--cyan);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;"><path d="M12 5v10M8 15l4 4 4-4"/><path d="M3 19h18"/></svg>Installer E.V.A sur ce téléphone</button>',
      tip: 'Sur iPhone (Safari) : bouton Partager → "Sur l\'écran d\'accueil". Sur Android : Chrome vous proposera l\'installation automatiquement.'
    }
  ];

  var _steps = [];
  var _currentStep = 0;

  function _isMobile() {
    var touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    var narrow = window.innerWidth < 900;
    return touch && narrow;
  }

  function _buildDots() {
    var dots = document.getElementById('tutoDots');
    if (!dots) return;
    dots.innerHTML = '';
    for (var i = 0; i < _steps.length; i++) {
      var d = document.createElement('div');
      d.className = 'tuto-dot' + (i === _currentStep ? ' active' : '');
      dots.appendChild(d);
    }
  }

  function _renderStep() {
    var s = _steps[_currentStep];
    if (!s) return;
    var total = _steps.length;
    var pct = Math.round((_currentStep / (total - 1)) * 100);

    var fill    = document.getElementById('tutoPFill');
    var visual  = document.getElementById('tutoVisualArea');
    var lbl     = document.getElementById('tutoStepLbl');
    var title   = document.getElementById('tutoTitle');
    var desc    = document.getElementById('tutoDesc');
    var tip     = document.getElementById('tutiTip');
    var nextBtn = document.getElementById('tutoNextBtn');

    if (fill) fill.style.width = pct + '%';
    if (visual) visual.innerHTML = s.visual ? s.visual() : '';
    if (lbl)  lbl.textContent  = 'Étape ' + (_currentStep + 1) + ' sur ' + total;
    if (title) title.innerHTML = s.title;
    if (desc) desc.innerHTML = s.desc;
    if (tip) {
      if (s.tip) { tip.innerHTML = s.tip; tip.style.display = ''; }
      else        { tip.style.display = 'none'; }
    }
    if (nextBtn) {
      nextBtn.textContent = _currentStep === total - 1 ? 'Commencer ✓' : 'Suivant →';
    }
    _buildDots();
  }

  function tutoNext() {
    if (_currentStep < _steps.length - 1) {
      _currentStep++;
      _renderStep();
    } else {
      tutoClose();
    }
  }
  window.tutoNext = tutoNext;

  function tutoSkip() {
    tutoClose();
  }
  window.tutoSkip = tutoSkip;

  function tutoClose() {
    var overlay = document.getElementById('tutorialOverlay');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.3s ease';
      setTimeout(function() {
        overlay.style.display = 'none';
        overlay.style.opacity = '';
        overlay.style.transition = '';
      }, 300);
    }
    try { localStorage.setItem(TUTO_KEY, '1'); } catch(e) {}
  }

  function showTutorial(forceSteps) {
    _steps = forceSteps || (_isMobile() ? STEPS_MOBILE : STEPS_PC);
    _currentStep = 0;
    _renderStep();
    var overlay = document.getElementById('tutorialOverlay');
    if (overlay) overlay.style.display = 'flex';
  }
  window.showTutorialAuto   = function() { showTutorial(); };
  window.showTutorialPC     = function() { showTutorial(STEPS_PC); };
  window.showTutorialMobile = function() { showTutorial(STEPS_MOBILE); };

  /* Déclenchement — après authentification réussie */
  function maybeShowTutorial() {
    try {
      if (localStorage.getItem(TUTO_KEY)) return;
    } catch(e) { return; }
    /* Délai pour laisser l'UI se charger complètement */
    setTimeout(showTutorial, 1600);
  }

  /* Hook sur l'événement authReady émis par initAuth */
  document.addEventListener('eva:authReady', function() {
    maybeShowTutorial();
    if (window._initPathRouter) window._initPathRouter();
  });
  /* Fallback : si l'event n'arrive pas, on réessaie après load complet */
  window.addEventListener('load', function() {
    setTimeout(function() {
      try {
        if (!localStorage.getItem(TUTO_KEY)) {
          var overlay = document.getElementById('tutorialOverlay');
          /* Ne montrer que si l'utilisateur est connecté (body visible) */
          if (overlay && overlay.style.display === 'none') {
            /* Vérification via état S global */
            if (window.S && window.S.user) maybeShowTutorial();
          }
        }
      } catch(e) {}
    }, 3000);
  });
})();
