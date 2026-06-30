async function loadNotes() {
  if (!S.user) return;
  try {
    var snap = await db.collection('users').doc(S.user.uid)
      .collection('notes').orderBy('updatedAt','desc').limit(50).get();
    var notes = [];
    snap.forEach(function(d){ notes.push(Object.assign({id:d.id},d.data())); });
    renderNotes(notes);
  } catch(e) { console.error('loadNotes:',e); }
}

var _S = 'viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"';
var _SVG_EDIT  = '<svg '+_S+'><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
var _SVG_TRASH = '<svg '+_S+'><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4h6v2"/></svg>';
var _SVG_X     = '<svg '+_S+'><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
var _SVG_CHECK = '<svg viewBox="0 0 24 24" style="width:11px;height:11px;stroke:#fff;fill:none;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"><polyline points="20 6 9 17 4 12"/></svg>';

/* ── Notes state ── */
var _notesCache = [];
var _noteSelectedTag = '';
var _noteSelectedColor = '#7b8bf5';

function openNoteModal(id) {
  S.editingNoteId = id || null;
  var m = document.getElementById('noteModal');
  var t = document.getElementById('noteModalTitle');
  if (id) {
    var n = _notesCache.find(function(x){ return x.id === id; });
    t.textContent = 'MODIFIER LA NOTE';
    document.getElementById('noteTitleInput').value = n ? (n.title||'') : '';
    document.getElementById('noteBodyInput').value = n ? (n.body||'') : '';
    document.getElementById('noteTagInput').value = n ? (n.tag||'') : '';
    _noteSelectedColor = (n && n.color) || 'var(--cyan)';
    var opts = document.querySelectorAll('.note-color-opt');
    opts.forEach(function(o){ o.classList.toggle('active', o.dataset.color === _noteSelectedColor); });
  } else {
    t.textContent = 'NOUVELLE NOTE';
    document.getElementById('noteTitleInput').value = '';
    document.getElementById('noteBodyInput').value = '';
    document.getElementById('noteTagInput').value = '';
    _noteSelectedColor = '#7b8bf5';
    document.querySelectorAll('.note-color-opt').forEach(function(o){ o.classList.toggle('active', o.dataset.color === 'var(--cyan)'); });
  }
  m.classList.add('open');
  setTimeout(function(){ document.getElementById('noteTitleInput').focus(); }, 80);
}
window.openNoteModal = openNoteModal;

function closeNoteModal() {
  document.getElementById('noteModal').classList.remove('open');
  S.editingNoteId = null;
}
window.closeNoteModal = closeNoteModal;

function selectNoteColor(color, el) {
  _noteSelectedColor = color;
  document.querySelectorAll('.note-color-opt').forEach(function(o){ o.classList.remove('active'); });
  el.classList.add('active');
}
window.selectNoteColor = selectNoteColor;

function renderNotes(notes) {
  _notesCache = notes;
  _renderFilteredNotes();
}

function _renderFilteredNotes() {
  var list = document.getElementById('notesList');
  if (!list) return;
  var search = (document.getElementById('noteSearch') || {}).value || '';
  var q = search.toLowerCase();
  var notes = _notesCache.filter(function(n){
    if (_noteSelectedTag && n.tag !== _noteSelectedTag) return false;
    if (q && (n.title||'').toLowerCase().indexOf(q) === -1 && (n.body||'').toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
  /* Render tag filter bar */
  var tagsEl = document.getElementById('noteTagFilters');
  if (tagsEl) {
    var allTags = [];
    _notesCache.forEach(function(n){ if (n.tag && allTags.indexOf(n.tag) === -1) allTags.push(n.tag); });
    tagsEl.innerHTML = allTags.length ? ['<div class="note-tag-chip'+('' === _noteSelectedTag?' active':'')+'" onclick="setNoteTag(\'\')">Tout</div>']
      .concat(allTags.map(function(t){
        return '<div class="note-tag-chip'+(_noteSelectedTag===t?' active':'')+'" onclick="setNoteTag(\''+esc(t)+'\')">'+esc(t)+'</div>';
      })).join('') : '';
  }
  if (!notes.length) {
    list.className = '';
    list.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" fill="none" stroke-width="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg><p>'+(_notesCache.length?'Aucun résultat':'Aucune note — créez votre première !')+'</p></div>';
    return;
  }
  list.className = 'notes-grid';
  list.innerHTML = notes.map(function(n) {
    var d = n.updatedAt && n.updatedAt.toDate ? n.updatedAt.toDate().toLocaleDateString('fr-FR') : '';
    var color = n.color || '#7b8bf5';
    var tagStyle = 'background:'+color+'22;color:'+color+';border:1px solid '+color+'44;';
    return '<div class="note-card" onclick="openNoteModal(\''+n.id+'\')">' +
      '<div class="note-card-accent" style="background:'+color+'"></div>' +
      '<div class="note-card-body">' +
        '<div class="note-actions" onclick="event.stopPropagation()">' +
          '<button class="note-act-btn" onclick="openNoteModal(\''+n.id+'\')" title="Modifier">'+_SVG_EDIT+'</button>' +
          '<button class="note-act-btn del" onclick="deleteNote(\''+n.id+'\')" title="Supprimer">'+_SVG_TRASH+'</button>' +
        '</div>' +
        '<div class="note-title">'+esc(n.title||'Sans titre')+'</div>' +
        '<div class="note-body">'+esc(n.body||'')+'</div>' +
        '<div class="note-meta">'+(d?'<span>'+d+'</span>':'')+(n.tag?'<span class="note-tag" style="'+tagStyle+'">'+esc(n.tag)+'</span>':'')+'</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function filterNotes(q) { _renderFilteredNotes(); }
window.filterNotes = filterNotes;

function setNoteTag(tag) { _noteSelectedTag = tag; _renderFilteredNotes(); }
window.setNoteTag = setNoteTag;

async function saveNote() {
  var title = document.getElementById('noteTitleInput').value.trim();
  var body = document.getElementById('noteBodyInput').value.trim();
  var tag = document.getElementById('noteTagInput').value.trim();
  if (!title && !body) { toast('Entrez un titre ou du contenu','error'); return; }
  if (!S.user) return;
  try {
    var data = { title:title, body:body, tag:tag, color:_noteSelectedColor, updatedAt:window.timestamp() };
    if (S.editingNoteId) {
      await db.collection('users').doc(S.user.uid).collection('notes').doc(S.editingNoteId).update(data);
      toast('Note mise à jour ✓','success');
    } else {
      data.createdAt = window.timestamp();
      await db.collection('users').doc(S.user.uid).collection('notes').add(data);
      toast('Note créée ✓','success');
    }
    closeNoteModal();
    loadNotes();
  } catch(e) { toast('Erreur sauvegarde','error'); }
}
window.saveNote = saveNote;

function editNote(id) { openNoteModal(id); }
window.editNote = editNote;

async function deleteNote(id) {
  if (!confirm('Supprimer cette note ?')) return;
  try {
    await db.collection('users').doc(S.user.uid).collection('notes').doc(id).delete();
    toast('Note supprimée','success');
    loadNotes();
  } catch(e) { toast('Erreur','error'); }
}
window.deleteNote = deleteNote;

function cancelNoteForm() { closeNoteModal(); }
window.cancelNoteForm = cancelNoteForm;

/* ═══════════════════════════════════════════════════
   ALARMS
═══════════════════════════════════════════════════ */
var alarmIntervals = {};

async function loadAlarms() {
  if (!S.user) return;
  try {
    var snap = await db.collection('users').doc(S.user.uid)
      .collection('alarms').orderBy('time').get();
    var alarms = [];
    snap.forEach(function(d){ alarms.push(Object.assign({id:d.id},d.data())); });
    renderAlarms(alarms);
  } catch(e) {}
}

/* ── Alarms state ── */
var _alarmsCache = [];

function _alarmNextRing(time, repeat, days) {
  if (!time) return '';
  var now = new Date();
  var parts = time.split(':');
  var h = parseInt(parts[0],10), m = parseInt(parts[1],10);
  var candidate = new Date(now);
  candidate.setHours(h,m,0,0);
  if (candidate <= now) candidate.setDate(candidate.getDate()+1);
  for (var tries=0; tries<8; tries++) {
    var wd = candidate.getDay();
    var ok = false;
    if (repeat === 'daily') ok = true;
    else if (repeat === 'weekdays') ok = (wd>=1&&wd<=5);
    else if (repeat === 'weekend') ok = (wd===0||wd===6);
    else if (repeat === 'custom' && Array.isArray(days)) ok = days.indexOf(wd)!==-1;
    else ok = true;
    if (ok) break;
    candidate.setDate(candidate.getDate()+1);
  }
  var diffMs = candidate - now;
  if (diffMs < 0) return '';
  var diffM = Math.round(diffMs/60000);
  if (diffM < 60) return 'dans '+diffM+' min';
  var diffH = Math.floor(diffM/60);
  var remM = diffM % 60;
  return 'dans '+diffH+'h'+(remM?remM+'':'');
}

function openAlarmModal(id) {
  S.editingAlarmId = id || null;
  var m = document.getElementById('alarmModal');
  var title = document.getElementById('alarmModalTitle');
  if (id) {
    var a = _alarmsCache.find(function(x){ return x.id === id; });
    title.textContent = 'MODIFIER L\'ALARME';
    document.getElementById('alarmTimeInput').value = a ? (a.time||'') : '';
    document.getElementById('alarmLabelInput').value = a ? (a.label||'') : '';
    var repeatVal = a ? (a.repeat||'once') : 'once';
    document.getElementById('alarmRepeatInput').value = repeatVal;
    document.getElementById('alarmCustomDays').style.display = repeatVal==='custom' ? '' : 'none';
    var selDays = (a && a.days) || [];
    document.querySelectorAll('.alarm-day-btn').forEach(function(btn){
      btn.classList.toggle('active', selDays.indexOf(parseInt(btn.dataset.day))!==-1);
    });
  } else {
    title.textContent = 'NOUVELLE ALARME';
    document.getElementById('alarmTimeInput').value = '';
    document.getElementById('alarmLabelInput').value = '';
    document.getElementById('alarmRepeatInput').value = 'once';
    document.getElementById('alarmCustomDays').style.display = 'none';
    document.querySelectorAll('.alarm-day-btn').forEach(function(btn){ btn.classList.remove('active'); });
  }
  m.classList.add('open');
}
window.openAlarmModal = openAlarmModal;

function closeAlarmModal() {
  document.getElementById('alarmModal').classList.remove('open');
  S.editingAlarmId = null;
}
window.closeAlarmModal = closeAlarmModal;

function onAlarmRepeatChange(val) {
  document.getElementById('alarmCustomDays').style.display = val==='custom' ? '' : 'none';
}
window.onAlarmRepeatChange = onAlarmRepeatChange;

function toggleAlarmDay(btn) {
  btn.classList.toggle('active');
}
window.toggleAlarmDay = toggleAlarmDay;

function renderAlarms(alarms) {
  _alarmsCache = alarms;
  var list = document.getElementById('alarmsList');
  if (!list) return;
  if (!alarms.length) {
    list.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" fill="none" stroke-width="1.5"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="m4 5 1.5 1.5M20 5l-1.5 1.5"/></svg><p>Aucune alarme — créez-en une !</p></div>';
    return;
  }
  var repeatLabels = {once:'Une fois',daily:'Tous les jours',weekdays:'Lun–Ven',weekend:'Sam–Dim',custom:'Personnalisé'};
  var dayNames = ['DIM','LUN','MAR','MER','JEU','VEN','SAM'];
  list.innerHTML = alarms.map(function(a) {
    var nextRing = a.active ? _alarmNextRing(a.time, a.repeat, a.days) : '';
    var daysHtml = '';
    if (a.repeat==='custom' && Array.isArray(a.days) && a.days.length) {
      daysHtml = '<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">' +
        a.days.map(function(d){ return '<span class="alarm-day-dot">'+dayNames[d]+'</span>'; }).join('') + '</div>';
    }
    return '<div class="alarm-item'+(a.active?'':' inactive')+'">' +
      '<div class="alarm-item-left">' +
        '<div class="alarm-time-display">'+(a.time||'00:00')+'</div>' +
        (nextRing ? '<div class="alarm-next-ring">'+nextRing+'</div>' : '') +
      '</div>' +
      '<div class="alarm-info">' +
        '<div class="alarm-label">'+esc(a.label||'Alarme')+'</div>' +
        '<div class="alarm-detail"><span>'+(repeatLabels[a.repeat]||'Une fois')+'</span></div>' +
        daysHtml +
      '</div>' +
      '<div class="alarm-actions">' +
        '<button class="alarm-act-btn" onclick="openAlarmModal(\''+a.id+'\')" title="Modifier">'+_SVG_EDIT+'</button>' +
        '<label class="alarm-toggle">' +
          '<input type="checkbox"'+(a.active?' checked':'')+' onchange="toggleAlarm(\''+a.id+'\',this.checked)">' +
          '<span class="alarm-slider"></span>' +
        '</label>' +
        '<button class="alarm-act-btn del" onclick="deleteAlarm(\''+a.id+'\')" title="Supprimer">'+_SVG_TRASH+'</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function saveAlarm() {
  var time = document.getElementById('alarmTimeInput').value;
  var repeat = document.getElementById('alarmRepeatInput').value;
  var label = document.getElementById('alarmLabelInput').value.trim();
  if (!time) { toast('Choisissez une heure','error'); return; }
  if (!S.user) return;
  var days = [];
  if (repeat === 'custom') {
    document.querySelectorAll('.alarm-day-btn.active').forEach(function(btn){ days.push(parseInt(btn.dataset.day)); });
    if (!days.length) { toast('Sélectionnez au moins un jour','error'); return; }
  }
  try {
    var data = { time:time, repeat:repeat, label:label||'Alarme', days:days, updatedAt:window.timestamp() };
    if (S.editingAlarmId) {
      await db.collection('users').doc(S.user.uid).collection('alarms').doc(S.editingAlarmId).update(data);
      toast('Alarme mise à jour ✓','success');
    } else {
      data.active = true;
      data.createdAt = window.timestamp();
      await db.collection('users').doc(S.user.uid).collection('alarms').add(data);
      toast('Alarme créée ✓','success');
    }
    closeAlarmModal();
    loadAlarms();
  } catch(e) { toast('Erreur','error'); }
}
window.saveAlarm = saveAlarm;

async function toggleAlarm(id, active) {
  if (!S.user) return;
  try {
    await db.collection('users').doc(S.user.uid).collection('alarms').doc(id).update({active:active});
    loadAlarms();
  } catch(e) {}
}
window.toggleAlarm = toggleAlarm;

async function deleteAlarm(id) {
  if (!confirm('Supprimer cette alarme ?')) return;
  try {
    await db.collection('users').doc(S.user.uid).collection('alarms').doc(id).delete();
    toast('Alarme supprimée','success');
    loadAlarms();
  } catch(e) { toast('Erreur','error'); }
}
window.deleteAlarm = deleteAlarm;

function cancelAlarmForm() { closeAlarmModal(); }
window.cancelAlarmForm = cancelAlarmForm;

/* ═══════════════════════════════════════════════════
   SERVICE WORKER — NOTIFICATIONS PUSH
═══════════════════════════════════════════════════ */
var swRegistration = null;

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    navigator.serviceWorker.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'STOP_ALARM_SOUND') {
        stopAlarmAudio();
        if (!e.data.snoozed) hideAlarmOverlay();
      }
    });
  } catch(err) {
    console.warn('SW registration failed:', err);
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  var perm = await Notification.requestPermission();
  return perm === 'granted';
}

function showSwNotification(type, payload) {
  if (!swRegistration || !swRegistration.active) return false;
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  var msg = Object.assign({ type: type }, payload || {});
  swRegistration.active.postMessage(msg);
  return true;
}

/* ═══════════════════════════════════════════════════
   ALARM CHECKER — AMÉLIORÉ
═══════════════════════════════════════════════════ */
var alarmAudio = null;
var alarmAudioTimeout = null;
var firedAlarms = {};

function setupNotifications() {
  registerServiceWorker();
  setInterval(checkAlarms, 30000);
  setInterval(checkRemindersTime, 60000);
}

async function checkAlarms() {
  if (!S.user) return;
  var now = new Date();
  var hhmm = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  var today = now.toISOString().slice(0,10);
  var key = hhmm + '_' + today;
  if (firedAlarms[key]) return;
  try {
    var snap = await db.collection('users').doc(S.user.uid).collection('alarms')
      .where('active','==',true).where('time','==',hhmm).get();
    if (snap.empty) return;
    firedAlarms[key] = true;
    snap.forEach(function(d) {
      var a = d.data();
      triggerAlarm(a.label || 'Alarme', d.id);
    });
  } catch(e) {}
}

function triggerAlarm(label, id) {
  /* Éviter le double déclenchement (client + FCM serveur) */
  if (id) {
    if (firedAlarms['id_' + id]) return;
    firedAlarms['id_' + id] = true;
  }
  toast('⏰ ' + label, 'info');
  showAlarmOverlay(label);
  startAlarmAudio();
  _showDirectNotif('⏰ E.V.A — Alarme', label, {
    tag: 'eva-alarm-' + (id || Date.now()),
    requireInteraction: true
  });
}

function startAlarmAudio() {
  stopAlarmAudio();
  try {
    alarmAudio = new Audio('/assets/sounds/alarm.mp3');
    alarmAudio.loop = true;
    alarmAudio.volume = 0.75;
    alarmAudio.play().catch(function() {
      try {
        alarmAudio = new Audio('/assets/sounds/alarm.wav');
        alarmAudio.loop = true; alarmAudio.volume = 0.75;
        alarmAudio.play().catch(function(){
          try { alarmAudio = new Audio('/assets/sounds/notification.mp3'); alarmAudio.loop = true; alarmAudio.volume = 0.6; alarmAudio.play(); } catch(e3) {}
        });
      } catch(e2) {}
    });
    alarmAudioTimeout = setTimeout(function() { stopAlarmAudio(); hideAlarmOverlay(); }, 120000);
  } catch(e) {}
}

function stopAlarmAudio() {
  if (alarmAudio) { try { alarmAudio.pause(); alarmAudio.currentTime = 0; } catch(e) {} alarmAudio = null; }
  if (alarmAudioTimeout) { clearTimeout(alarmAudioTimeout); alarmAudioTimeout = null; }
}

function showAlarmOverlay(label) {
  var ov = document.getElementById('alarmOverlay');
  if (!ov) return;
  var labelEl = document.getElementById('alarmOverlayLabel');
  if (labelEl) labelEl.textContent = label || 'Alarme';
  var timeEl = document.getElementById('alarmOverlayTime');
  if (timeEl) {
    var n = new Date();
    timeEl.textContent = n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0');
  }
  ov.classList.add('active');
}

function hideAlarmOverlay() {
  var ov = document.getElementById('alarmOverlay');
  if (ov) ov.classList.remove('active');
}

function alarmStop() {
  stopAlarmAudio();
  hideAlarmOverlay();
}
window.alarmStop = alarmStop;

function alarmSnooze() {
  var label = (document.getElementById('alarmOverlayLabel') || {}).textContent || 'Alarme';
  stopAlarmAudio();

  // Afficher la nouvelle heure dans l'overlay avant de masquer
  var snoozeTime = new Date(Date.now() + 5 * 60 * 1000);
  var snoozeHH = snoozeTime.getHours().toString().padStart(2,'0');
  var snoozeMM = snoozeTime.getMinutes().toString().padStart(2,'0');
  var timeEl = document.getElementById('alarmOverlayTime');
  var labelEl = document.getElementById('alarmOverlayLabel');
  if (timeEl) timeEl.textContent = '💤 Reportée à ' + snoozeHH + ':' + snoozeMM;
  if (labelEl) labelEl.textContent = label;
  // Masquer l'overlay après 2 secondes
  setTimeout(function() {
    hideAlarmOverlay();
  }, 2000);

  toast('💤 Alarme reportée à ' + snoozeHH + ':' + snoozeMM, 'info');
  setTimeout(function() {
    triggerAlarm(label + ' ⏰ +5 min', null);
  }, 5 * 60 * 1000);
}
window.alarmSnooze = alarmSnooze;

/* ═══════════════════════════════════════════════════
   FCM — PUSH NOTIFICATIONS FIREBASE CLOUD MESSAGING
═══════════════════════════════════════════════════ */
var _fcmMessaging = null;
var _fcmToken = null;

var _EVA_VAPID_KEY = 'BJvMsuUPHrTyTy6hXtZwEQLdD6Mjuolw_4x9ycVwoPTnNVx5Kp7XEV1eZPH8dspmv8PlqU2lsOqAVzPItpdZm7w';

async function initFCM() {
  if (!S.user) return;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
  try {
    var vapidKey = _EVA_VAPID_KEY;

    /* Enregistrer le service worker */
    var swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    /* Initialiser Firebase Messaging */
    if (!_fcmMessaging) {
      _fcmMessaging = firebase.messaging();
    }

    /* Si permission déjà accordée → enregistrer le token */
    if (Notification.permission === 'granted') {
      await _fcmRegisterToken(swReg, vapidKey);
    }

    /* Messages quand l'app est au premier plan (data-only) */
    _fcmMessaging.onMessage(function(payload) {
      var data  = payload.data || {};
      var title = data.title || 'E.V.A';
      var body  = data.body  || '';
      var type  = data.type  || 'general';

      if (type === 'alarm') {
        /* Déclencher la vraie alarme si l'overlay n'est pas déjà visible */
        var ov = document.getElementById('alarmOverlay');
        if (!ov || !ov.classList.contains('active')) {
          triggerAlarm(body || data.label || title, data.alarmId || null);
        } else {
          _showDirectNotif(title, body, { tag: data.tag, requireInteraction: true });
        }
      } else if (type === 'reminder') {
        /* Déclencher le rappel côté client */
        var fakeReminder = { text: body || title, id: data.reminderId || data.tag || null, datetimeObj: new Date() };
        triggerReminder(fakeReminder);
      } else {
        /* Notification générique (calendar, test, etc.) */
        _showDirectNotif(title, body, { tag: data.tag });
        toast('🔔 ' + title + (body ? ' — ' + body : ''), 'info');
      }
    });

  } catch(e) {
    console.warn('[FCM] initFCM error:', e);
  }
}

function _parseDeviceName() {
  var ua = navigator.userAgent;
  var browser = 'Navigateur';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  var os = '';
  if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone/.test(ua)) os = 'iPhone';
  else if (/iPad/.test(ua)) os = 'iPad';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return browser + (os ? ' sur ' + os : '');
}

async function _fcmRegisterToken(swReg, vapidKey) {
  try {
    if (!_fcmMessaging) return;
    var token = await _fcmMessaging.getToken({ vapidKey: vapidKey, serviceWorkerRegistration: swReg });
    if (!token) return;
    _fcmToken = token;
    if (S.user && db) {
      var deviceObj = {
        token:        token,
        name:         _parseDeviceName(),
        registeredAt: new Date().toISOString(),
        userAgent:    navigator.userAgent.substring(0, 200)
      };
      /* Lire les devices existants, retirer l'entrée avec ce même token, ajouter la nouvelle */
      var userSnap = await db.collection('users').doc(S.user.uid).get();
      var existingDevices = (userSnap.exists && Array.isArray(userSnap.data().fcmDevices))
        ? userSnap.data().fcmDevices.filter(function(d){ return d.token !== token; })
        : [];
      existingDevices.push(deviceObj);
      await db.collection('users').doc(S.user.uid).set({
        fcmDevices:       existingDevices,
        fcmTokens:        firebase.firestore.FieldValue.arrayUnion(token),
        fcmTokenUpdated:  new Date().toISOString(),
        timezoneOffset:   new Date().getTimezoneOffset()
      }, { merge: true });
      /* Mettre à jour le profil local */
      if (S.profile) S.profile.fcmDevices = existingDevices;
    }
    console.log('[FCM] Token enregistré (multi-appareils)');
  } catch(e) {
    console.warn('[FCM] getToken error:', e);
    throw e;
  }
}

async function activateNotifications() {
  if (!('Notification' in window)) {
    toast('Les notifications ne sont pas supportées par ce navigateur', 'error');
    return;
  }
  try {
    var perm = await Notification.requestPermission();
    if (perm === 'granted') {
      var vapidKey = _EVA_VAPID_KEY;
      if (vapidKey) {
        /* Initialiser Firebase Messaging à la demande si pas encore fait */
        if (!_fcmMessaging) {
          try { _fcmMessaging = firebase.messaging(); } catch(e2) {
            console.warn('[FCM] messaging() init error:', e2);
          }
        }
        if (_fcmMessaging) {
          var swReg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')
                      || await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          /* Attendre que le service worker soit actif */
          if (swReg.installing || swReg.waiting) {
            await new Promise(function(resolve) {
              var sw = swReg.installing || swReg.waiting;
              sw.addEventListener('statechange', function() {
                if (sw.state === 'activated') resolve();
              });
              setTimeout(resolve, 3000);
            });
          }
          await _fcmRegisterToken(swReg, vapidKey);
          toast('🔔 Notifications activées — restez sur le site pour les recevoir !', 'success');
        } else {
          toast('⚠️ Firebase Messaging indisponible sur ce navigateur', 'error');
        }
      } else {
        toast('⚠️ Clé VAPID manquante — vérifiez la configuration Firebase', 'error');
      }
      renderSettings('notifications');
    } else {
      toast('Notifications refusées', 'error');
      renderSettings('notifications');
    }
  } catch(e) {
    console.error('[FCM] activateNotifications error:', e);
    toast('Erreur : ' + e.message, 'error');
  }
}
window.activateNotifications = activateNotifications;

async function deactivateNotifications() {
  if (_fcmToken && S.user && db) {
    await revokeDevice(_fcmToken, true);
  } else {
    toast('Pour désactiver complètement, cliquez sur 🔒 dans la barre d\'adresse → bloquer les notifications', 'info');
  }
}
window.deactivateNotifications = deactivateNotifications;

async function revokeDevice(token, isSelf) {
  if (!token || !S.user || !db) return;
  try {
    var updatedDevices = (S.profile && Array.isArray(S.profile.fcmDevices))
      ? S.profile.fcmDevices.filter(function(d){ return d.token !== token; })
      : [];
    await db.collection('users').doc(S.user.uid).update({
      fcmTokens:  firebase.firestore.FieldValue.arrayRemove(token),
      fcmDevices: updatedDevices
    });
    if (S.profile) {
      S.profile.fcmDevices = updatedDevices;
      if (Array.isArray(S.profile.fcmTokens)) {
        S.profile.fcmTokens = S.profile.fcmTokens.filter(function(t){ return t !== token; });
      }
    }
    if (token === _fcmToken) _fcmToken = null;
    toast(isSelf ? '🔕 Push désactivé sur cet appareil — les autres restent actifs' : '🗑️ Appareil révoqué', 'info');
    renderSettings('notifications');
  } catch(e) {
    toast('Erreur : ' + e.message, 'error');
  }
}
window.revokeDevice = revokeDevice;

async function testNotification() {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    toast('Activez d\'abord les notifications', 'error');
    return;
  }

  /* 1. Notification directe immédiate — toujours fiable quand la page est ouverte */
  _showDirectNotif(
    '🧪 Test — E.V.A',
    'Notification directe reçue ! Le push FCM arrive en parallèle.',
    { tag: 'eva-test-direct-' + Date.now() }
  );
  toast('🧪 Test en cours — notification directe + push FCM…', 'info');

  /* ℹ️ En hébergement statique (Netlify), les notifications push en arrière-plan
     nécessitent que l'application soit ouverte dans le navigateur.
     Les alarmes et rappels fonctionnent tant que l'onglet EVA est actif. */
  toast('✅ Notification de test envoyée — les alertes fonctionnent quand l\'app est ouverte', 'success');
}
window.testNotification = testNotification;

/* Affiche une notification système directe (new Notification) sans service worker.
   La méthode la plus fiable en foreground — fonctionne sur Chrome, Edge, Firefox. */
function _showDirectNotif(title, body, data) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    var opts = {
      body:               body || '',
      icon:               '/assets/images/favicon.svg',
      badge:              '/assets/images/favicon.svg',
      tag:                (data && data.tag) ? data.tag : ('eva-notif-' + Date.now()),
      requireInteraction: !!(data && data.requireInteraction)
    };
    var n = new Notification(title || 'E.V.A', opts);
    n.onclick = function() { n.close(); window.focus(); };
  } catch(e) {
    console.warn('[FCM] showDirectNotif error:', e);
  }
}

function _testLocalNotif() {
  try {
    _showDirectNotif(
      '🧪 Test — E.V.A',
      'Les notifications fonctionnent correctement sur cet appareil !',
      { tag: 'eva-test-' + Date.now() }
    );
    toast('✅ Notification locale envoyée', 'success');
  } catch(e) {
    toast('Erreur : ' + e.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════
   REMINDERS — RAPPELS
═══════════════════════════════════════════════════ */
var activeRemindersCache = [];
var firedReminders = {};

async function loadReminders() {
  if (!S.user) return;
  try {
    var snap = await db.collection('users').doc(S.user.uid)
      .collection('reminders').orderBy('datetime','asc').get();
    var reminders = [];
    snap.forEach(function(d) {
      var data = d.data();
      var dt = data.datetime && data.datetime.toDate ? data.datetime.toDate() : (data.datetime ? new Date(data.datetime) : null);
      reminders.push(Object.assign({ id: d.id }, data, { datetimeObj: dt }));
    });
    activeRemindersCache = reminders.filter(function(r){ return !r.completed; });
    renderReminders(reminders);
  } catch(e) { console.error('loadReminders:', e); }
}

/* ── Reminders state ── */
var _remindersCache = [];

function openReminderModal(id) {
  S.editingReminderId = id || null;
  var m = document.getElementById('reminderModal');
  var title = document.getElementById('reminderModalTitle');
  if (id) {
    var r = _remindersCache.find(function(x){ return x.id === id; });
    title.textContent = 'MODIFIER LE RAPPEL';
    document.getElementById('reminderTextInput').value = r ? (r.text||'') : '';
    if (r && r.datetimeObj) {
      var dt = r.datetimeObj;
      document.getElementById('reminderDateInput').value = dt.toISOString().split('T')[0];
      document.getElementById('reminderTimeInput').value = dt.toTimeString().slice(0,5);
    } else {
      document.getElementById('reminderDateInput').value = '';
      document.getElementById('reminderTimeInput').value = '';
    }
    document.getElementById('reminderPrioInput').value = r ? (r.priority||'medium') : 'medium';
  } else {
    title.textContent = 'NOUVEAU RAPPEL';
    document.getElementById('reminderTextInput').value = '';
    document.getElementById('reminderDateInput').value = '';
    document.getElementById('reminderTimeInput').value = '';
    document.getElementById('reminderPrioInput').value = 'medium';
  }
  m.classList.add('open');
  setTimeout(function(){ document.getElementById('reminderTextInput').focus(); }, 80);
}
window.openReminderModal = openReminderModal;

function closeReminderModal() {
  document.getElementById('reminderModal').classList.remove('open');
  S.editingReminderId = null;
}
window.closeReminderModal = closeReminderModal;

function renderReminders(reminders) {
  _remindersCache = reminders;
  var list = document.getElementById('remindersList');
  if (!list) return;
  if (!reminders.length) {
    list.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" fill="none" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><p>Aucun rappel — créez le premier !</p></div>';
    return;
  }
  var now = new Date();
  var pending = reminders.filter(function(r){ return !r.completed && (!r.datetimeObj || r.datetimeObj >= now); });
  var overdue = reminders.filter(function(r){ return !r.completed && r.datetimeObj && r.datetimeObj < now; });
  var done    = reminders.filter(function(r){ return r.completed; });

  var prioBadge = { high:'<span class="reminder-prio-badge prio-badge-high">HAUTE</span>', medium:'<span class="reminder-prio-badge prio-badge-medium">MOYENNE</span>', low:'<span class="reminder-prio-badge prio-badge-low">BASSE</span>' };
  var prioClass = { high:' prio-high', medium:' prio-medium', low:' prio-low' };

  function renderGroup(group, className) {
    return group.map(function(r) {
      var dt = r.datetimeObj;
      var timeStr = '';
      if (dt) {
        timeStr = dt.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}) + ' à ' + dt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      }
      var prio = r.priority || 'medium';
      var done = r.completed ? ' done' : '';
      var pc = r.completed ? '' : (prioClass[prio]||'');
      return '<div class="reminder-item'+done+pc+'">' +
        '<div class="reminder-check" onclick="toggleReminder(\''+r.id+'\','+(!r.completed)+')">'+(r.completed?_SVG_CHECK:'')+'</div>'+
        '<div class="reminder-body">'+
          '<div class="reminder-text">'+esc(r.text||'Rappel')+'</div>'+
          (timeStr?'<div class="reminder-time'+(className===' overdue'?' overdue':'')+'">'+timeStr+(className===' overdue'?' · Dépassé':'')+'</div>':'') +
        '</div>'+
        (!r.completed ? (prioBadge[prio]||'') : '') +
        '<div class="reminder-acts">'+
          (!r.completed ? '<button class="reminder-act-btn" onclick="openReminderModal(\''+r.id+'\')" title="Modifier">'+_SVG_EDIT+'</button>' : '') +
          '<button class="reminder-act-btn del" onclick="deleteReminder(\''+r.id+'\')" title="Supprimer">'+_SVG_TRASH+'</button>'+
        '</div>'+
      '</div>';
    }).join('');
  }

  var html = '';
  if (overdue.length) {
    html += '<div class="reminder-group-title" style="color:#ff4d6d">⚠ Dépassés ('+overdue.length+')</div>' + renderGroup(overdue, ' overdue');
  }
  if (pending.length) {
    html += '<div class="reminder-group-title">À faire ('+pending.length+')</div>' + renderGroup(pending, '');
  }
  if (done.length) {
    html += '<div class="reminder-group-title">Terminés ('+done.length+')</div>' + renderGroup(done, ' done');
  }
  list.innerHTML = html;
}

async function saveReminder() {
  var text = document.getElementById('reminderTextInput').value.trim();
  var date = document.getElementById('reminderDateInput').value;
  var time = document.getElementById('reminderTimeInput').value;
  var prio = document.getElementById('reminderPrioInput').value;
  if (!text) { toast('Entrez un message pour le rappel', 'error'); return; }
  if (!S.user) return;
  var dt = null;
  if (date && time) dt = new Date(date + 'T' + time + ':00');
  else if (date) dt = new Date(date + 'T09:00:00');
  try {
    var data = { text:text, datetime:dt||null, priority:prio, updatedAt:window.timestamp() };
    if (S.editingReminderId) {
      await db.collection('users').doc(S.user.uid).collection('reminders').doc(S.editingReminderId).update(data);
      toast('Rappel mis à jour ✓','success');
    } else {
      data.completed = false; data.notified = false; data.createdAt = window.timestamp();
      await db.collection('users').doc(S.user.uid).collection('reminders').add(data);
      toast('Rappel créé ✓','success');
    }
    closeReminderModal();
    loadReminders();
  } catch(e) { toast('Erreur','error'); }
}
window.saveReminder = saveReminder;

async function toggleReminder(id, completed) {
  if (!S.user) return;
  try {
    await db.collection('users').doc(S.user.uid).collection('reminders').doc(id).update({
      completed:completed, completedAt:completed?window.timestamp():null
    });
    loadReminders();
  } catch(e) {}
}
window.toggleReminder = toggleReminder;

async function deleteReminder(id) {
  if (!confirm('Supprimer ce rappel ?')) return;
  try {
    await db.collection('users').doc(S.user.uid).collection('reminders').doc(id).delete();
    toast('Rappel supprimé','success');
    loadReminders();
  } catch(e) { toast('Erreur','error'); }
}
window.deleteReminder = deleteReminder;

function cancelReminderForm() { closeReminderModal(); }
window.cancelReminderForm = cancelReminderForm;

/* ─── Vérificateur de rappels ─── */
function checkRemindersTime() {
  if (!S.user || !activeRemindersCache.length) return;
  var now = new Date();
  activeRemindersCache.forEach(function(r) {
    if (r.completed || !r.datetimeObj) return;
    var key = 'rem_' + r.id;
    if (firedReminders[key]) return;
    if (r.datetimeObj <= now) {
      firedReminders[key] = true;
      triggerReminder(r);
    }
  });
}

function triggerReminder(r) {
  /* Éviter le double déclenchement (FCM + checkRemindersTime) */
  if (r.id) {
    var key = 'rem_' + r.id;
    if (firedReminders[key]) return;
    firedReminders[key] = true;
  }
  toast('📌 ' + (r.text || 'Rappel'), 'info');
  _showDirectNotif('📌 E.V.A — Rappel', r.text || 'Rappel', {
    tag: 'eva-reminder-' + (r.id || Date.now()),
    requireInteraction: true
  });
  try { var audio = new Audio('assets/sounds/notification.mp3'); audio.volume = 0.5; audio.play(); } catch(e) {}
  if (S.user) {
    db.collection('users').doc(S.user.uid).collection('reminders').doc(r.id)
      .update({ notified: true }).catch(function(){});
  }
  activeRemindersCache = activeRemindersCache.filter(function(rem){ return rem.id !== r.id; });
}

/* ═══════════════════════════════════════════════════
   CALENDAR
═══════════════════════════════════════════════════ */
var FR_MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function initCalendar() {
  var d = new Date();
  S.calYear = d.getFullYear();
  S.calMonth = d.getMonth();
}

/* ── Events state ── */
var _eventsCache = [];
var _calSelectedDate = '';
var _eventSelectedCat = 'work';
var _eventCatColors = { work:'var(--cyan)', personal:'#a855f7', health:'#22c55e', social:'#f59e0b', other:'#8b9bb4' };

function goToday() {
  var now = new Date();
  S.calYear = now.getFullYear(); S.calMonth = now.getMonth();
  renderCalendar();
}
window.goToday = goToday;

function selectDay(dateStr) {
  _calSelectedDate = (_calSelectedDate === dateStr) ? '' : dateStr;
  renderCalendar();
  var titleEl = document.getElementById('eventsListTitle');
  if (titleEl) titleEl.textContent = _calSelectedDate ? ('ÉVÉNEMENTS DU ' + _calSelectedDate.split('-').reverse().join('/')) : 'TOUS LES ÉVÉNEMENTS';
  _renderFilteredEvents();
}
window.selectDay = selectDay;

function renderCalendar() {
  var el = document.getElementById('calMonthYear');
  if (el) el.textContent = FR_MONTHS[S.calMonth] + ' ' + S.calYear;
  var grid = document.getElementById('calDays');
  if (!grid) return;
  var first = new Date(S.calYear, S.calMonth, 1);
  var startDay = (first.getDay() + 6) % 7;
  var daysInMonth = new Date(S.calYear, S.calMonth+1, 0).getDate();
  var prevDays = new Date(S.calYear, S.calMonth, 0).getDate();
  var today = new Date();
  var todayStr = today.getFullYear()+'-'+(today.getMonth()+1).toString().padStart(2,'0')+'-'+today.getDate().toString().padStart(2,'0');
  /* Build map of dateStr → events */
  var evByDate = {};
  _eventsCache.forEach(function(ev){
    if (!evByDate[ev.date]) evByDate[ev.date] = [];
    evByDate[ev.date].push(ev);
  });
  var html = '';
  for (var i = startDay - 1; i >= 0; i--) {
    html += '<div class="cal-day other-month">'+(prevDays-i)+'</div>';
  }
  for (var d2 = 1; d2 <= daysInMonth; d2++) {
    var dateStr = S.calYear+'-'+(S.calMonth+1).toString().padStart(2,'0')+'-'+d2.toString().padStart(2,'0');
    var cls = 'cal-day';
    if (dateStr === todayStr) cls += ' today';
    if (dateStr === _calSelectedDate) cls += ' selected';
    var evs = evByDate[dateStr] || [];
    var dots = evs.slice(0,3).map(function(ev){ return '<div class="cal-dot" style="background:'+(_eventCatColors[ev.category]||'#7b8bf5')+'"></div>'; }).join('');
    html += '<div class="'+cls+'" onclick="selectDay(\''+dateStr+'\')">'+d2+(dots?'<div class="cal-day-dots">'+dots+'</div>':'')+'</div>';
  }
  var total = startDay + daysInMonth;
  var remaining = (7 - (total % 7)) % 7;
  for (var j = 1; j <= remaining; j++) {
    html += '<div class="cal-day other-month">'+j+'</div>';
  }
  grid.innerHTML = html;
}

async function loadEvents() {
  if (!S.user) return;
  try {
    var snap = await db.collection('users').doc(S.user.uid)
      .collection('events').orderBy('date','asc').get();
    _eventsCache = [];
    snap.forEach(function(d){ _eventsCache.push(Object.assign({id:d.id},d.data())); });
    renderCalendar();
    _renderFilteredEvents();
  } catch(e) {}
}

function _renderFilteredEvents() {
  var list = document.getElementById('eventsList');
  if (!list) return;
  var events = _calSelectedDate
    ? _eventsCache.filter(function(ev){ return ev.date === _calSelectedDate; })
    : _eventsCache;
  if (!events.length) {
    list.innerHTML = '<div class="empty-state" style="padding:16px 0"><p>Aucun événement'+(+_calSelectedDate?' ce jour-là':'')+' — créez-en un !</p></div>';
    return;
  }
  list.innerHTML = events.map(function(ev) {
    var color = _eventCatColors[ev.category] || 'var(--cyan)';
    var dateDisp = ev.date ? ev.date.split('-').reverse().join('/') : '';
    return '<div class="event-item" style="border-left-color:'+color+'">' +
      '<div class="event-cat-dot" style="background:'+color+'"></div>' +
      '<div class="event-item-main">' +
        (ev.time ? '<div class="event-time">'+esc(ev.time)+'</div>' : '') +
        '<div class="event-title-text">'+esc(ev.title||'Événement')+'</div>' +
        (ev.description ? '<div class="event-desc">'+esc(ev.description)+'</div>' : '') +
      '</div>' +
      '<div class="event-date-badge">'+dateDisp+'</div>' +
      '<div class="event-acts">' +
        '<button class="event-act-btn" onclick="openEventModal(\''+ev.id+'\')" title="Modifier">'+_SVG_EDIT+'</button>' +
        '<button class="event-act-btn del" onclick="deleteEvent(\''+ev.id+'\')" title="Supprimer">'+_SVG_TRASH+'</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function renderEvents(events) { _renderFilteredEvents(); }

function openEventModal(id) {
  S.editingEventId = id || null;
  var m = document.getElementById('eventModal');
  var title = document.getElementById('eventModalTitle');
  if (id) {
    var ev = _eventsCache.find(function(x){ return x.id === id; });
    title.textContent = 'MODIFIER L\'ÉVÉNEMENT';
    document.getElementById('eventTitleInput').value = ev ? (ev.title||'') : '';
    document.getElementById('eventDateInput').value = ev ? (ev.date||'') : '';
    document.getElementById('eventTimeInput').value = ev ? (ev.time||'') : '';
    document.getElementById('eventDescInput').value = ev ? (ev.description||'') : '';
    _eventSelectedCat = ev ? (ev.category||'work') : 'work';
  } else {
    title.textContent = 'NOUVEL ÉVÉNEMENT';
    document.getElementById('eventTitleInput').value = '';
    document.getElementById('eventDateInput').value = _calSelectedDate || '';
    document.getElementById('eventTimeInput').value = '';
    document.getElementById('eventDescInput').value = '';
    _eventSelectedCat = 'work';
  }
  document.querySelectorAll('.event-cat-opt').forEach(function(o){
    o.classList.toggle('active', o.dataset.cat === _eventSelectedCat);
  });
  m.classList.add('open');
  setTimeout(function(){ document.getElementById('eventTitleInput').focus(); }, 80);
}
window.openEventModal = openEventModal;

function closeEventModal() {
  document.getElementById('eventModal').classList.remove('open');
  S.editingEventId = null;
}
window.closeEventModal = closeEventModal;

function selectEventCat(cat, el) {
  _eventSelectedCat = cat;
  document.querySelectorAll('.event-cat-opt').forEach(function(o){ o.classList.remove('active'); });
  el.classList.add('active');
}
window.selectEventCat = selectEventCat;

async function saveEvent() {
  var title = document.getElementById('eventTitleInput').value.trim();
  var date = document.getElementById('eventDateInput').value;
  var time = document.getElementById('eventTimeInput').value;
  var desc = document.getElementById('eventDescInput').value.trim();
  if (!title) { toast('Entrez un titre','error'); return; }
  if (!date) { toast('Choisissez une date','error'); return; }
  if (!S.user) return;
  try {
    var data = { title:title, date:date, time:time, description:desc, category:_eventSelectedCat, updatedAt:window.timestamp() };
    if (S.editingEventId) {
      await db.collection('users').doc(S.user.uid).collection('events').doc(S.editingEventId).update(data);
      toast('Événement mis à jour ✓','success');
    } else {
      data.createdAt = window.timestamp();
      await db.collection('users').doc(S.user.uid).collection('events').add(data);
      toast('Événement créé ✓','success');
    }
    closeEventModal();
    loadEvents();
  } catch(e) { toast('Erreur','error'); }
}
window.saveEvent = saveEvent;

async function deleteEvent(id) {
  if (!confirm('Supprimer cet événement ?')) return;
  try {
    await db.collection('users').doc(S.user.uid).collection('events').doc(id).delete();
    toast('Événement supprimé','success');
    loadEvents();
  } catch(e) { toast('Erreur','error'); }
}
window.deleteEvent = deleteEvent;

function cancelEventForm() { closeEventModal(); }
window.cancelEventForm = cancelEventForm;
