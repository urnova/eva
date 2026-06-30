
/* ═══════════════════════════════════════════════════
   UI SETUP
═══════════════════════════════════════════════════ */
function setupUI() {
  // Hamburger
  document.getElementById('hamburgerBtn').addEventListener('click', toggleSidebar);


  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

  // Send
  document.getElementById('sendBtn').addEventListener('click', handleSend);
  document.getElementById('msgInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  document.getElementById('msgInput').addEventListener('input', function() {
    autoResize(this);
    var hasAttach = S.image || S.document || (S.images && S.images.length) || (S.documents && S.documents.length);
    document.getElementById('sendBtn').disabled = !this.value.trim() && !hasAttach;
  });

  // TTS — état chargé depuis localStorage
  var ttsBtn = document.getElementById('ttsBtn');
  window.updateTtsBtn = function() {
    if (!ttsBtn) return;
    ttsBtn.classList.toggle('tts-on', S.ttsOn);
    ttsBtn.title = S.ttsOn ? 'Voix activée — cliquer pour désactiver' : 'Voix désactivée — cliquer pour activer';
    document.getElementById('ttsBtnIcon').innerHTML = S.ttsOn
      ? '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>'
      : '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
  };
  window.updateTtsBtn();
  if (window.updateProviderBadge) window.updateProviderBadge();
  ttsBtn.addEventListener('click', function() {
    S.ttsOn = !S.ttsOn;
    S.config.ttsOn = S.ttsOn;
    saveCfg();
    window.updateTtsBtn();
    toast(S.ttsOn ? '🔊 Voix activée' : '🔇 Voix désactivée');
  });

  // WAKE WORD — état chargé depuis localStorage
  var wakeWordBtn = document.getElementById('wakeWordBtn');
  wakeWordBtn.classList.toggle('active', S.wakeWordOn);
  if (S.wakeWordOn && window.EVAWakeWord) {
    setTimeout(function(){ window.EVAWakeWord.start(); }, 1000);
  }
  wakeWordBtn.addEventListener('click', function() {
    S.wakeWordOn = !S.wakeWordOn;
    S.config.wakeWordOn = S.wakeWordOn;
    saveCfg();
    this.classList.toggle('active', S.wakeWordOn);
    if (S.wakeWordOn) {
      if (window.EVAWakeWord) window.EVAWakeWord.start();
      toast('🎤 Wake Word activé — Dites "Hey Eva"');
    } else {
      if (window.EVAWakeWord) window.EVAWakeWord.stop();
      toast('🔇 Wake Word désactivé');
    }
  });

  // EVA panel toggle (quick strip toujours visible)
  document.getElementById('evaToggleBtn').addEventListener('click', function() {
    S.evaOpen = !S.evaOpen;
    document.getElementById('evaPanel').classList.toggle('collapsed', !S.evaOpen);
    this.style.opacity = S.evaOpen ? '1' : '0.5';
  });

  // Nav
  document.querySelectorAll('.nav-item[data-view]').forEach(function(el) {
    el.addEventListener('click', function() { setView(this.dataset.view); });
  });

  // New conv
  document.getElementById('newConvBtn').addEventListener('click', newConv);

  // ── Tone dropdown ──
  window.toggleToneMenu = function(e) {
    e.stopPropagation();
    var btn = document.getElementById('toneSelectBtn');
    var dd  = document.getElementById('toneDropdown');
    var open = dd.classList.contains('open');
    // Close any other open dropdown first
    closeToneMenu();
    /* Fermer le dropdown modèle */
    var mb = document.getElementById('convModelBtn');
    var md = document.getElementById('modelDropdown');
    if (mb) { mb.classList.remove('open'); mb.setAttribute('aria-expanded','false'); }
    if (md) md.classList.remove('open');
    if (!open) {
      btn.classList.add('open');
      dd.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  };
  window.closeToneMenu = function() {
    var btn = document.getElementById('toneSelectBtn');
    var dd  = document.getElementById('toneDropdown');
    if (btn) { btn.classList.remove('open'); btn.setAttribute('aria-expanded','false'); }
    if (dd)  { dd.classList.remove('open'); }
  };
  window.selectTone = function(optEl) {
    var tone  = optEl.dataset.tone;
    var icon  = optEl.dataset.icon;
    var label = optEl.dataset.label;
    // Update button display
    var iconEl  = document.getElementById('toneSelectIcon');
    var labelEl = document.getElementById('toneSelectLabel');
    if (iconEl)  iconEl.textContent  = icon;
    if (labelEl) labelEl.textContent = label;
    // Mark active
    document.querySelectorAll('.tone-option').forEach(function(o){ o.classList.remove('active'); });
    optEl.classList.add('active');
    // Apply tone to state
    S.tone = tone;
    closeToneMenu();
    /* Mode Code : désactiver la voix automatiquement */
    if (tone === 'code') {
      if (window.EVATTS && !window.EVATTS.getMuted()) {
        S.ttsOn = false;
        if (window.EVATTS) window.EVATTS.setMuted(true);
        var ttsBtn = document.getElementById('ttsBtn');
        if (ttsBtn) ttsBtn.classList.remove('active');
        toast('🔇 Mode Code — voix désactivée', 'info');
      }
    }
  };
  // Close dropdown on outside click
  document.addEventListener('click', function(e) {
    var wrap = document.getElementById('toneSelectWrap');
    if (wrap && !wrap.contains(e.target)) closeToneMenu();
    /* Fermer le dropdown modèle si clic ailleurs */
    var modelWrap = document.getElementById('convModelWrap');
    if (modelWrap && !modelWrap.contains(e.target)) {
      var mb = document.getElementById('convModelBtn');
      var md = document.getElementById('modelDropdown');
      if (mb) { mb.classList.remove('open'); mb.setAttribute('aria-expanded','false'); }
      if (md) md.classList.remove('open');
    }
  });
  // Close on Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeToneMenu();
      var mb = document.getElementById('convModelBtn');
      var md = document.getElementById('modelDropdown');
      if (mb) { mb.classList.remove('open'); mb.setAttribute('aria-expanded','false'); }
      if (md) md.classList.remove('open');
    }
  });

  // Prompt chips
  document.querySelectorAll('.prompt-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      document.getElementById('msgInput').value = this.dataset.prompt;
      document.getElementById('sendBtn').disabled = false;
      handleSend();
    });
  });

  // Settings (accessible uniquement via le menu utilisateur)
  document.getElementById('settingsMenuBtn').addEventListener('click', function() { openSettings('profile'); });
  document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings);
  document.getElementById('settingsModal').addEventListener('click', function(e) {
    if (e.target === this) closeSettings();
  });
  document.querySelectorAll('.settings-nav').forEach(function(nav) {
    nav.addEventListener('click', function() {
      document.querySelectorAll('.settings-nav').forEach(function(n){n.classList.remove('active');});
      this.classList.add('active');
      renderSettings(this.dataset.section);
      pushRoute('/chat/settings/' + this.dataset.section);
    });
  });

  // User menu
  document.getElementById('userCard').addEventListener('click', function(e) {
    e.stopPropagation();
    this.classList.toggle('open');
  });
  document.addEventListener('click', function(e) {
    var uc = document.getElementById('userCard');
    if (uc) uc.classList.remove('open');
    /* Fermer les dropdowns de conversation si clic ailleurs */
    if (!e.target.closest('.conv-menu-wrap')) {
      document.querySelectorAll('.conv-dropdown.open').forEach(function(d){ d.classList.remove('open'); });
    }
  });

  // Sign out
  document.getElementById('signOutBtn').addEventListener('click', function() {
    if (confirm('Se déconnecter de E.V.A ?')) {
      auth.signOut().then(function() { window.location.href = '/'; });
    }
  });

  // File attach
  document.getElementById('attachBtn').addEventListener('click', function() {
    document.getElementById('fileInput').click();
  });
  document.getElementById('fileInput').addEventListener('change', handleFileSelect);

  // Drag & drop + paste d'images
  if (window.initChatDragDropPaste) window.initChatDragDropPaste();

  // Mic
  document.getElementById('micBtn').addEventListener('click', handleMic);

  // Search
  document.getElementById('searchInput').addEventListener('input', function() { filterConvs(this.value); });

  // Alarms
  document.getElementById('newAlarmBtn').addEventListener('click', function() { openAlarmModal(null); });

  // Events
  document.getElementById('newEventBtn').addEventListener('click', function() { openEventModal(null); });

  // Calendar nav
  document.getElementById('calPrevBtn').addEventListener('click', function() {
    S.calMonth--; if (S.calMonth < 0) { S.calMonth = 11; S.calYear--; }
    renderCalendar();
  });
  document.getElementById('calNextBtn').addEventListener('click', function() {
    S.calMonth++; if (S.calMonth > 11) { S.calMonth = 0; S.calYear++; }
    renderCalendar();
  });

  // Notes
  document.getElementById('newNoteBtn').addEventListener('click', function() { openNoteModal(null); });

  // Reminders
  document.getElementById('newReminderBtn').addEventListener('click', function() { openReminderModal(null); });
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 150) + 'px';
}

/* ═══ SIDEBAR ═══ */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('active');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

/* ═══ ROUTING ═══ */
function pushRoute(p) {
  if (window.location.pathname !== p) history.pushState({}, '', p);
}
window.pushRoute = pushRoute;

window._initPathRouter = function() {
  var p = window.location.pathname;
  if (p === '/chat' || p === '/chat/' || p === '/chat.html') return;
  if (p.startsWith('/chat/settings')) {
    var sub = p.replace('/chat/settings', '').replace(/^\/+/, '') || 'profile';
    setTimeout(function() { openSettings(sub || 'profile'); }, 900);
  } else {
    var view = p.replace(/^\/chat\//, '') || 'chat';
    if (view === 'agenda') view = 'calendar';
    var valid = ['notes','alarms','reminders','calendar','cloudworks','reports','visionRepair','visionAssist'];
    if (valid.indexOf(view) !== -1) {
      setTimeout(function() { setView(view); }, 900);
    }
  }
};

window.addEventListener('popstate', function() {
  var p = window.location.pathname;
  if (p.startsWith('/chat/settings')) {
    var sub = p.replace('/chat/settings', '').replace(/^\/+/, '') || 'profile';
    openSettings(sub || 'profile');
  } else {
    var m = document.getElementById('settingsModal');
    if (m) m.classList.remove('open');
    var view = p.replace(/^\/chat\//, '') || 'chat';
    if (view === 'agenda') view = 'calendar';
    var valid = ['notes','alarms','reminders','calendar','reports','visionRepair','visionAssist'];
    setView(valid.indexOf(view) !== -1 ? view : 'chat');
  }
});

/* ═══ VIEWS ═══ */
function setView(name) {
  window._currentView = name;
  document.querySelectorAll('.view').forEach(function(v){v.classList.remove('active');});
  document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active');});
  var cap = name.charAt(0).toUpperCase() + name.slice(1);
  var vEl = document.getElementById('view'+cap);
  if (vEl) vEl.classList.add('active');
  var nEl = document.querySelector('.nav-item[data-view="'+name+'"]');
  if (nEl) nEl.classList.add('active');
  /* ── Mode pleine page pour les vues dédiées ── */
  document.body.setAttribute('data-view', name);
  if (name === 'notes') loadNotes();
  if (name === 'alarms') loadAlarms();
  if (name === 'reminders') loadReminders();
  if (name === 'calendar') { loadEvents(); renderCalendar(); }
  if (name === 'cloudworks' && window.loadCloudWorks) loadCloudWorks();
  pushRoute(name === 'chat' ? '/chat' : '/chat/' + name);
}
window.setView = setView;

/* ═══════════════════════════════════════════════════
   CONVERSATIONS
═══════════════════════════════════════════════════ */