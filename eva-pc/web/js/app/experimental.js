/* ═══════════════════════════════════════════════════
   EXPERIMENTAL FEATURES — E.V.A V4
   Gestion des fonctions expérimentales (OFF par défaut)
═══════════════════════════════════════════════════ */
(function() {
  'use strict';

  /* ── Clé localStorage ── */
  var EXP_KEY = 'eva_experimental';

  /* ── Lire l'état expérimental ── */
  /* Priorité : S.config.experimentalFeatures (Firestore) > localStorage */
  function isExperimentalEnabled() {
    try {
      /* Si le profil Firestore est chargé, il fait foi (sync multi-appareils) */
      if (window.S && window.S.config && typeof window.S.config.experimentalFeatures === 'boolean') {
        return window.S.config.experimentalFeatures;
      }
      return localStorage.getItem(EXP_KEY) === '1';
    } catch(e) { return false; }
  }
  window.isExperimentalEnabled = isExperimentalEnabled;

  /* ── Sauvegarder l'état ── */
  function setExperimental(enabled) {
    try {
      if (enabled) localStorage.setItem(EXP_KEY, '1');
      else localStorage.removeItem(EXP_KEY);
    } catch(e) {}
    applyExperimental(enabled);

    /* Aussi sauver dans cfg() si disponible */
    if (window.cfg && window.saveCfg) {
      try {
        var c = window.cfg();
        c.experimentalFeatures = !!enabled;
        window.saveCfg();
      } catch(e) {}
    }

    /* Aussi sauver en Firestore si le profil est chargé */
    if (window.S && window.S.user && window.db) {
      try {
        window.db.collection('users').doc(window.S.user.uid)
          .set({ preferences: { experimentalFeatures: !!enabled } }, { merge: true });
      } catch(e) {}
    }
  }
  window.setExperimental = setExperimental;

  /* ── Appliquer l'état (masquer / afficher éléments) ── */
  function applyExperimental(enabled) {
    /* CloudWorks nav item */
    var cwNav = document.getElementById('navCloudWorks');
    if (cwNav) {
      cwNav.style.display = enabled ? '' : 'none';
    }

    /* Si on désactive et qu'on est sur CloudWorks → revenir au chat */
    if (!enabled && window._currentView === 'cloudworks' && window.setView) {
      window.setView('chat');
    }
  }
  window.applyExperimental = applyExperimental;

  /* ── Rendre la section Expérimental dans les paramètres ── */
  function renderExperimentalSection() {
    var c = document.getElementById('settingsContent');
    if (!c) return;
    var enabled = isExperimentalEnabled();

    c.innerHTML =
      '<div class="settings-section">' +
      '<div class="settings-section-title">Fonctions Expérimentales</div>' +
      '<div style="font-size:0.82em;color:var(--text-muted);margin-bottom:20px;line-height:1.7;">' +
      'Ces fonctionnalités sont en cours de développement actif. Elles peuvent être instables ou changer sans préavis.' +
      '</div>' +

      /* Main experimental toggle */
      '<div class="exp-toggle-card' + (enabled ? ' exp-active' : '') + '" id="expMainCard">' +
      '<div class="exp-toggle-top">' +
      '<div class="exp-icon">⚗️</div>' +
      '<div class="exp-info">' +
      '<div class="exp-name">Fonctions expérimentales</div>' +
      '<div class="exp-desc">Active l\'accès aux modules en cours de développement, notamment <strong>CloudWorks</strong> (gestion des appareils à distance).</div>' +
      '</div>' +
      '<label class="toggle-switch" style="flex-shrink:0;">' +
      '<input type="checkbox" id="expMainToggle"' + (enabled ? ' checked' : '') + ' onchange="window._onExpToggle(this.checked)">' +
      '<span class="toggle-slider"></span>' +
      '</label>' +
      '</div>' +
      (enabled ?
        '<div class="exp-active-bar">' +
        '<span class="exp-active-dot"></span>Fonctions expérimentales <strong>activées</strong>' +
        '</div>' : ''
      ) +
      '</div>' +

      /* Feature list */
      '<div class="exp-features-list">' +
      '<div class="exp-features-title">Fonctions disponibles</div>' +
      '<div class="exp-feature-item' + (enabled ? ' exp-feature-on' : '') + '">' +
      '<div class="exp-feature-icon">☁️</div>' +
      '<div class="exp-feature-info">' +
      '<div class="exp-feature-name">CloudWorks</div>' +
      '<div class="exp-feature-desc">Gérez et contrôlez vos ordinateurs à distance depuis E.V.A (capture d\'écran, veille, commandes).</div>' +
      '</div>' +
      '<span class="exp-feature-badge">' + (enabled ? '✓ Actif' : 'Inactif') + '</span>' +
      '</div>' +
      '</div>' +

      '</div>' +

      /* Inline styles for this section */
      '<style>' +
      '.exp-toggle-card{background:var(--surface);border:1px solid rgba(123,139,245,0.12);border-radius:16px;overflow:hidden;margin-bottom:20px;transition:border-color 0.2s;}' +
      '.exp-toggle-card.exp-active{border-color:rgba(123,139,245,0.35);}' +
      '.exp-toggle-top{display:flex;align-items:flex-start;gap:14px;padding:18px;}' +
      '.exp-icon{font-size:1.6em;flex-shrink:0;line-height:1;}' +
      '.exp-info{flex:1;min-width:0;}' +
      '.exp-name{font-weight:700;font-size:0.9em;color:var(--text);margin-bottom:4px;}' +
      '.exp-desc{font-size:0.78em;color:var(--text-muted);line-height:1.6;}' +
      '.exp-desc strong{color:var(--cyan);}' +
      '.exp-active-bar{display:flex;align-items:center;gap:8px;padding:10px 18px;background:rgba(123,139,245,0.07);border-top:1px solid rgba(123,139,245,0.1);font-size:0.78em;color:var(--cyan);}' +
      '.exp-active-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;box-shadow:0 0 6px rgba(74,222,128,0.6);animation:expPulse 2s ease-in-out infinite;}' +
      '@keyframes expPulse{0%,100%{opacity:1}50%{opacity:0.4}}' +
      '.exp-features-list{background:var(--surface);border:1px solid rgba(123,139,245,0.1);border-radius:16px;overflow:hidden;}' +
      '.exp-features-title{font-family:"Orbitron",monospace;font-size:0.6em;letter-spacing:2px;color:var(--text-muted);text-transform:uppercase;padding:14px 18px 10px;border-bottom:1px solid rgba(123,139,245,0.08);}' +
      '.exp-feature-item{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(123,139,245,0.06);}' +
      '.exp-feature-item:last-child{border-bottom:none;}' +
      '.exp-feature-icon{font-size:1.3em;flex-shrink:0;}' +
      '.exp-feature-info{flex:1;min-width:0;}' +
      '.exp-feature-name{font-weight:700;font-size:0.85em;color:var(--text);margin-bottom:3px;}' +
      '.exp-feature-desc{font-size:0.74em;color:var(--text-muted);line-height:1.5;}' +
      '.exp-feature-badge{flex-shrink:0;font-size:0.7em;font-weight:700;letter-spacing:0.5px;padding:3px 10px;border-radius:20px;border:1px solid rgba(123,139,245,0.2);color:var(--text-muted);background:rgba(123,139,245,0.05);}' +
      '.exp-feature-on .exp-feature-badge{color:#4ade80;border-color:rgba(74,222,128,0.3);background:rgba(74,222,128,0.07);}' +
      '</style>';
  }
  window.renderExperimentalSection = renderExperimentalSection;

  /* ── Handler toggle ── */
  window._onExpToggle = function(checked) {
    setExperimental(checked);
    /* Re-render the section to update UI */
    setTimeout(function() { renderExperimentalSection(); }, 80);
    if (checked) {
      if (window.toast) window.toast('Fonctions expérimentales activées — CloudWorks disponible', 'success');
    } else {
      if (window.toast) window.toast('Fonctions expérimentales désactivées', 'info');
    }
  };

  /* ── Étendre renderSettings pour gérer la section experimental ── */
  document.addEventListener('DOMContentLoaded', function() {
    /* Attendre que renderSettings soit défini */
    var _maxTries = 30, _tries = 0;
    var _poll = setInterval(function() {
      _tries++;
      if (window.renderSettings || _tries > _maxTries) {
        clearInterval(_poll);
        if (window.renderSettings) {
          var _orig = window.renderSettings;
          window.renderSettings = function(section) {
            if (section === 'experimental') {
              renderExperimentalSection();
              return;
            }
            _orig(section);
          };
        }
        /* Appliquer l'état expérimental au chargement */
        applyExperimental(isExperimentalEnabled());
      }
    }, 100);
  });

  /* ── Aussi appliquer à l'init de l'auth (pour les navigations directes) ── */
  document.addEventListener('eva:authReady', function() {
    /* Synchroniser Firestore → localStorage pour cohérence multi-appareils */
    if (window.S && window.S.config && typeof window.S.config.experimentalFeatures === 'boolean') {
      try {
        if (window.S.config.experimentalFeatures) {
          localStorage.setItem(EXP_KEY, '1');
        } else {
          localStorage.removeItem(EXP_KEY);
        }
      } catch(e) {}
    }
    applyExperimental(isExperimentalEnabled());
  });

})();
