/* =================================================================
   CW-FIRESTORE-ADAPTER.JS — Synchronisation Firestore ↔ CWEngine v5.6
   - Écoute les changements de tâche depuis Firebase
   - Fix race condition devices (attend auth.currentUser)
   - Sync les nouveaux champs d'état (10 états)
   ================================================================= */
(function() {
'use strict';

var HEARTBEAT_INTERVAL = 30 * 1000; // 30s
var _deviceHeartbeatTimer = null;
var _taskUnsubs = {};   // taskId → unsubscribe fn
var _devicesUnsub = null;

/* ───────────────────────────────────────────
   DEVICE HEARTBEAT (fix race condition auth)
─────────────────────────────────────────── */
function startDeviceHeartbeat(uid, deviceId, deviceName) {
  if (!uid || !deviceId) return;
  if (!window.db) return;

  function _beat() {
    if (!window.db || !uid) return;
    window.db
      .collection('cloudworks').doc(uid)
      .collection('devices').doc(deviceId)
      .set({
        deviceId:   deviceId,
        name:       deviceName || deviceId,
        online:     true,
        lastSeen:   window.timestamp ? window.timestamp() : new Date(),
        platform:   navigator.platform || 'unknown',
        userAgent:  navigator.userAgent.substring(0, 80),
        version:    '5.6.0'
      }, { merge: true })
      .catch(function(e) { console.warn('[CW-FS] heartbeat err:', e); });
  }

  _beat(); // immédiat
  _deviceHeartbeatTimer = setInterval(_beat, HEARTBEAT_INTERVAL);

  // Marquer offline à la fermeture
  window.addEventListener('beforeunload', function() {
    if (window.db && uid && deviceId) {
      window.db
        .collection('cloudworks').doc(uid)
        .collection('devices').doc(deviceId)
        .set({ online: false, lastSeen: window.timestamp ? window.timestamp() : new Date() }, { merge: true });
    }
    if (_deviceHeartbeatTimer) clearInterval(_deviceHeartbeatTimer);
  });
}

/* ───────────────────────────────────────────
   ÉCOUTE DEVICES (fix race condition)
─────────────────────────────────────────── */
function listenDevices(uid, onUpdate) {
  if (!window.db || !uid) return;
  if (_devicesUnsub) { _devicesUnsub(); _devicesUnsub = null; }

  _devicesUnsub = window.db
    .collection('cloudworks').doc(uid)
    .collection('devices')
    .onSnapshot(function(snap) {
      var devices = [];
      snap.forEach(function(doc) {
        devices.push(Object.assign({ id: doc.id }, doc.data()));
      });
      if (typeof onUpdate === 'function') onUpdate(devices);
    }, function(e) {
      console.warn('[CW-FS] listenDevices err:', e);
    });

  return _devicesUnsub;
}

/* ───────────────────────────────────────────
   CRÉER UNE COMMANDE DANS FIRESTORE
─────────────────────────────────────────── */
function pushCommand(uid, task) {
  if (!window.db || !uid || !task) return Promise.reject(new Error('db/uid/task manquant'));

  var doc = {
    id:          task.id,
    action:      task.prompt,
    state:       task.state || 'queued',
    plan:        task.plan || null,
    plan_hash:   task.planHash || null,
    created_at:  window.timestamp ? window.timestamp() : new Date(),
    updated_at:  window.timestamp ? window.timestamp() : new Date(),
    approved_at: null,
    completed_at:null,
    device_id:   task.deviceId || 'web',
    source:      'eva_web'
  };

  return window.db
    .collection('cloudworks').doc(uid)
    .collection('commands').doc(task.id)
    .set(doc);
}

/* ───────────────────────────────────────────
   METTRE À JOUR L'ÉTAT D'UNE COMMANDE
─────────────────────────────────────────── */
function updateCommandState(uid, taskId, state, extra) {
  if (!window.db || !uid || !taskId) return Promise.resolve();
  var update = Object.assign({
    state:      state,
    updated_at: window.timestamp ? window.timestamp() : new Date()
  }, extra || {});
  return window.db
    .collection('cloudworks').doc(uid)
    .collection('commands').doc(taskId)
    .set(update, { merge: true });
}

/* ───────────────────────────────────────────
   ÉCOUTER UNE COMMANDE (live)
─────────────────────────────────────────── */
function listenCommand(uid, taskId, onUpdate) {
  if (!window.db || !uid || !taskId) return function(){};
  var unsub = window.db
    .collection('cloudworks').doc(uid)
    .collection('commands').doc(taskId)
    .onSnapshot(function(doc) {
      if (doc.exists && typeof onUpdate === 'function') {
        onUpdate(Object.assign({ id: doc.id }, doc.data()));
      }
    }, function(e) {
      console.warn('[CW-FS] listenCommand err:', e);
    });
  _taskUnsubs[taskId] = unsub;
  return unsub;
}

/* ───────────────────────────────────────────
   CHARGER L'ACTIVITÉ RÉCENTE
─────────────────────────────────────────── */
function loadActivity(uid, limit, onResult) {
  if (!window.db || !uid) return;
  limit = limit || 20;
  window.db
    .collection('cloudworks').doc(uid)
    .collection('commands')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .get()
    .then(function(snap) {
      var items = [];
      snap.forEach(function(doc) {
        items.push(Object.assign({ id: doc.id }, doc.data()));
      });
      if (typeof onResult === 'function') onResult(items);
    })
    .catch(function(e) { console.warn('[CW-FS] loadActivity err:', e); });
}

/* ───────────────────────────────────────────
   JOURNALISER UNE ACTION
─────────────────────────────────────────── */
function logAction(uid, taskId, entry) {
  if (!window.db || !uid || !taskId) return;
  window.db
    .collection('users').doc(uid)
    .collection('cw_logs').doc(taskId)
    .collection('actions')
    .add(Object.assign({ ts: window.timestamp ? window.timestamp() : new Date() }, entry))
    .catch(function(e) { console.warn('[CW-FS] logAction err:', e); });
}

/* ───────────────────────────────────────────
   INIT AUTOMATIQUE APRÈS AUTH (corrige la race condition)
─────────────────────────────────────────── */
function initWithAuth(onReady) {
  function tryInit() {
    if (!window.firebase || !window.firebase.auth) {
      setTimeout(tryInit, 300);
      return;
    }
    window.firebase.auth().onAuthStateChanged(function(user) {
      if (user) {
        if (typeof onReady === 'function') onReady(user);
      }
    });
  }
  tryInit();
}

/* ───────────────────────────────────────────
   EXPORT GLOBAL
─────────────────────────────────────────── */
window.CWFirestore = {
  startDeviceHeartbeat: startDeviceHeartbeat,
  listenDevices:        listenDevices,
  pushCommand:          pushCommand,
  updateCommandState:   updateCommandState,
  listenCommand:        listenCommand,
  loadActivity:         loadActivity,
  logAction:            logAction,
  initWithAuth:         initWithAuth
};

})();
