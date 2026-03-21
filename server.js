const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 5000;
const ROOT = __dirname;

/* ═══════════════════════════════════════════════════════
   FIREBASE ADMIN — Push notifications (FCM)
   Requires env vars: FIREBASE_SERVICE_ACCOUNT (JSON string)
═══════════════════════════════════════════════════════ */
var admin  = null;
var db     = null;
var fcmOk  = false;

(function initAdmin() {
  var raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT non configuré — push désactivé');
    return;
  }
  try {
    var serviceAccount = JSON.parse(raw);
    var adminPkg = require('firebase-admin');
    if (!adminPkg.apps.length) {
      adminPkg.initializeApp({
        credential: adminPkg.credential.cert(serviceAccount)
      });
    }
    admin  = adminPkg;
    db     = adminPkg.firestore();
    fcmOk  = true;
    console.log('[FCM] firebase-admin initialisé ✓');
  } catch(e) {
    console.error('[FCM] Erreur init firebase-admin:', e.message);
  }
})();

/* ═══ ALARM & REMINDER CHECKER (toutes les 60s) ═══ */
var _notifLock = false;

async function checkAndNotify() {
  if (!fcmOk || !admin || _notifLock) return;
  _notifLock = true;
  try {
    var now = new Date();
    var usersSnap = await db.collection('users').get();

    for (var uDoc of usersSnap.docs) {
      var uid      = uDoc.id;
      var uData    = uDoc.data();
      var tzOffset = typeof uData.timezoneOffset === 'number' ? uData.timezoneOffset : 0;

      /* Récupérer tous les tokens (multi-appareils) avec compat ancien format */
      var tokens = [];
      if (Array.isArray(uData.fcmTokens) && uData.fcmTokens.length) {
        tokens = uData.fcmTokens.filter(Boolean);
      } else if (uData.fcmToken) {
        tokens = [uData.fcmToken];
      }
      if (!tokens.length) continue;

      /* Heure locale de l'utilisateur */
      var localNow = new Date(now.getTime() - tzOffset * 60000);
      var hhmm     = String(localNow.getHours()).padStart(2,'0') + ':' + String(localNow.getMinutes()).padStart(2,'0');
      var today    = localNow.toISOString().slice(0, 10);

      /* ─── Alarmes ─── */
      try {
        var alarmsSnap = await db.collection('users').doc(uid).collection('alarms').get();
        for (var aDoc of alarmsSnap.docs) {
          var alarm = aDoc.data();
          if (!alarm.active) continue;
          if (alarm.time !== hhmm) continue;
          var lastDate = alarm.lastNotifiedDate || '';
          if (alarm.repeat === 'once' && lastDate) continue;
          if (lastDate === today) continue;

          await sendFCMMulticast(tokens, uid, {
            title: '⏰ Alarme — ' + (alarm.label || hhmm),
            body:  alarm.label || ('Il est ' + hhmm),
            type:  'alarm',
            tag:   'alarm-' + aDoc.id,
            userId:  uid,
            alarmId: aDoc.id
          });

          var upd = { lastNotifiedDate: today };
          if (alarm.repeat === 'once') upd.active = false;
          await aDoc.ref.update(upd);
        }
      } catch(e) { console.warn('[FCM] alarms check error uid=' + uid, e.message); }

      /* ─── Rappels ─── */
      try {
        var remsSnap = await db.collection('users').doc(uid).collection('reminders')
          .where('completed', '==', false)
          .where('notified',  '==', false)
          .get();
        for (var rDoc of remsSnap.docs) {
          var rem = rDoc.data();
          if (!rem.datetime) continue;
          var remDate = rem.datetime.toDate ? rem.datetime.toDate() : new Date(rem.datetime);
          if (remDate > now) continue;

          await sendFCMMulticast(tokens, uid, {
            title: '📝 Rappel',
            body:  rem.text || 'Rappel E.V.A',
            type:  'reminder',
            tag:   'reminder-' + rDoc.id,
            userId: uid
          });
          await rDoc.ref.update({ notified: true });
        }
      } catch(e) { console.warn('[FCM] reminders check error uid=' + uid, e.message); }

      /* ─── Événements calendrier (alerte 15 min avant) ─── */
      try {
        var in15 = new Date(now.getTime() + 15 * 60000);
        var evSnap = await db.collection('users').doc(uid).collection('calendarEvents')
          .where('notified', '==', false)
          .get();
        for (var evDoc of evSnap.docs) {
          var ev = evDoc.data();
          if (!ev.start) continue;
          var evStart = ev.start.toDate ? ev.start.toDate() : new Date(ev.start);
          if (evStart > in15 || evStart < now) continue;

          await sendFCMMulticast(tokens, uid, {
            title: '📅 ' + (ev.title || 'Événement'),
            body:  'Dans 15 minutes' + (ev.location ? ' — ' + ev.location : ''),
            type:  'calendar',
            tag:   'event-' + evDoc.id,
            userId: uid
          });
          await evDoc.ref.update({ notified: true });
        }
      } catch(e) { /* calendar collection may not exist — skip silently */ }
    }
  } catch(e) {
    console.error('[FCM] checkAndNotify error:', e.message);
  } finally {
    _notifLock = false;
  }
}

/* Envoyer à TOUS les appareils d'un utilisateur en parallèle (multicast) */
async function sendFCMMulticast(tokens, uid, data) {
  if (!admin || !tokens || !tokens.length) return;
  var strData = {};
  for (var k in data) strData[k] = String(data[k]);

  /* Messages DATA-ONLY — pas de champ "notification" côté serveur.
     Cela force le SDK client/SW à toujours gérer l'affichage manuellement
     (évite la suppression silencieuse par Chrome en premier plan). */
  var multicastMsg = {
    tokens: tokens,
    data: strData,
    webpush: {
      headers: { Urgency: 'high' }
    },
    android: {
      priority: 'high',
      data: strData
    }
  };

  try {
    var result = await admin.messaging().sendEachForMulticast(multicastMsg);
    console.log('[FCM] Multicast (' + data.type + ') →', result.successCount + '/' + tokens.length + ' appareils');

    /* Supprimer les tokens invalides de Firestore */
    var staleTokens = [];
    result.responses.forEach(function(resp, idx) {
      if (!resp.success) {
        var code = resp.error && resp.error.code;
        if (code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token') {
          staleTokens.push(tokens[idx]);
        }
      }
    });
    if (staleTokens.length && uid && db) {
      var arrayRemove = admin.firestore.FieldValue.arrayRemove;
      await db.collection('users').doc(uid).update({
        fcmTokens: arrayRemove.apply(null, staleTokens)
      }).catch(function(){});
      console.log('[FCM] ' + staleTokens.length + ' token(s) expiré(s) supprimé(s) pour', uid);
    }
  } catch(e) {
    console.error('[FCM] sendFCMMulticast error:', e.message);
  }
}

/* Alias pour appels unitaires (test-notification) */
async function sendFCM(token, uid, data) {
  return sendFCMMulticast([token], uid, data);
}

if (fcmOk) {
  setInterval(checkAndNotify, 60 * 1000);
  setTimeout(checkAndNotify, 5000);
  console.log('[FCM] Vérificateur d\'alarmes actif (intervalle : 60s)');
}

/* ═══════════════════════════════════════════════════════
   SERVEUR HTTP
═══════════════════════════════════════════════════════ */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.mp3':  'audio/mpeg',
  '.wav':  'audio/wav',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.glb':  'model/gltf-binary',
  '.vrm':  'model/gltf-binary',
};

const PAGE_ROUTES = {
  '/':            'index.html',
  '/index':       'index.html',
  '/index.html':  'index.html',
  '/login':       'login.html',
  '/login.html':  'login.html',
  '/chat':        'chat.html',
  '/chat.html':   'chat.html',
  '/onboarding':  'onboarding.html',
  '/onboarding.html': 'onboarding.html',
  '/conditions':  'conditions.html',
  '/conditions.html': 'conditions.html',
  '/privacy':     'privacy.html',
  '/privacy.html':'privacy.html',
  '/cookies':     'cookies.html',
  '/cookies.html':'cookies.html',
};

function readBody(req) {
  return new Promise(function(resolve, reject) {
    var chunks = [];
    req.on('data', function(c) { chunks.push(c); });
    req.on('end',  function()  { resolve(Buffer.concat(chunks).toString()); });
    req.on('error', reject);
  });
}

function json(res, data, status) {
  res.writeHead(status || 200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function serveFile(res, filePath) {
  fs.readFile(filePath, function(err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    var ext  = path.extname(filePath).toLowerCase();
    var mime = MIME[ext] || 'application/octet-stream';
    var headers = { 'Content-Type': mime, 'Cache-Control': 'no-cache' };
    /* Service worker must have specific headers */
    if (filePath.endsWith('firebase-messaging-sw.js')) {
      headers['Service-Worker-Allowed'] = '/';
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}

const server = http.createServer(async function(req, res) {
  var url    = req.url.split('?')[0];
  var method = req.method;

  /* ─── API: config publique (VAPID key) ─── */
  if (url === '/api/config' && method === 'GET') {
    json(res, {
      vapidKey: process.env.FCM_VAPID_KEY || null,
      fcmEnabled: fcmOk
    });
    return;
  }

  /* ─── API: test notification ─── */
  if (url === '/api/test-notification' && method === 'POST') {
    try {
      var body = JSON.parse(await readBody(req));
      var userId = body.userId;
      if (!userId || !db) { json(res, { ok: false, error: 'userId requis' }, 400); return; }

      var uDoc   = await db.collection('users').doc(userId).get();
      var uData  = uDoc.exists ? uDoc.data() : {};
      var tokens = [];
      if (Array.isArray(uData.fcmTokens) && uData.fcmTokens.length) {
        tokens = uData.fcmTokens.filter(Boolean);
      } else if (uData.fcmToken) {
        tokens = [uData.fcmToken];
      }
      if (!tokens.length) { json(res, { ok: false, error: 'Token FCM introuvable — activez les notifications sur au moins un appareil' }, 404); return; }

      await sendFCMMulticast(tokens, userId, {
        title:  '🧪 Test — E.V.A',
        body:   'Les notifications push fonctionnent sur ' + tokens.length + ' appareil' + (tokens.length > 1 ? 's' : '') + ' ! Vos alarmes et rappels arriveront même quand le site est fermé.',
        type:   'test',
        tag:    'eva-test-' + Date.now(),
        userId: userId
      });
      json(res, { ok: true });
    } catch(e) {
      console.error('[API] test-notification error:', e.message);
      json(res, { ok: false, error: e.message }, 500);
    }
    return;
  }

  /* ─── API: snooze alarm (10 min) ─── */
  if (url === '/api/snooze-alarm' && method === 'POST') {
    try {
      var body = JSON.parse(await readBody(req));
      var userId  = body.userId;
      var alarmId = body.alarmId;
      if (!userId || !alarmId || !db) { json(res, { ok: false }, 400); return; }

      var now       = new Date();
      var snoozeMin = new Date(now.getTime() + 10 * 60000);
      var hhmm = String(snoozeMin.getHours()).padStart(2,'0') + ':' + String(snoozeMin.getMinutes()).padStart(2,'0');

      /* Créer une alarme temporaire (once) pour dans 10 min */
      await db.collection('users').doc(userId).collection('alarms').add({
        time:   hhmm,
        label:  'Alarme reportée',
        repeat: 'once',
        active: true,
        snooze: true,
        createdAt: now.toISOString()
      });

      /* Marquer l'alarme originale comme notifiée aujourd'hui */
      var today = now.toISOString().slice(0, 10);
      await db.collection('users').doc(userId).collection('alarms').doc(alarmId).update({
        lastNotifiedDate: today
      });

      json(res, { ok: true, snoozedTo: hhmm });
    } catch(e) {
      console.error('[API] snooze-alarm error:', e.message);
      json(res, { ok: false, error: e.message }, 500);
    }
    return;
  }

  /* ─── Pages statiques ─── */
  if (PAGE_ROUTES[url]) {
    serveFile(res, path.join(ROOT, PAGE_ROUTES[url]));
    return;
  }

  /* ─── Fichiers statiques ─── */
  var filePath = path.join(ROOT, url);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    if (url.startsWith('/js/lib/') || url.startsWith('/models/')) {
      var ext  = path.extname(filePath).toLowerCase();
      var mime = MIME[ext] || 'application/octet-stream';
      fs.readFile(filePath, function(err, data) {
        if (err) { res.writeHead(404); res.end('Not Found'); return; }
        res.writeHead(200, {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=31536000, immutable'
        });
        res.end(data);
      });
      return;
    }
    serveFile(res, filePath);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>404 — Page non trouvée</h1>');
});

server.listen(PORT, '0.0.0.0', function() {
  console.log('EVA server running on port ' + PORT);
});
